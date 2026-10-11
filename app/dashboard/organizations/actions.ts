"use server";
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { organizationFor } from '@/lib/organizations';
import { validId } from '@/lib/operations';
export async function createOrganization(form:FormData) {
 const s=await requireUser(),name=String(form.get('name')??'').trim();if(!name||name.length>160)redirect('/dashboard/organizations?error=Enter+an+organization+name');
 const c=await db().connect();try{await c.query('BEGIN');const o=(await c.query('INSERT INTO organizations(name,created_by) VALUES($1,$2) RETURNING id',[name,s.userId])).rows[0];await c.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')",[o.id,s.userId]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}redirect('/dashboard/organizations');
}
export async function inviteOrganizationMember(form:FormData) {
 const s=await requireUser(),id=String(form.get('organization_id')??''),email=String(form.get('email')??'').trim().toLowerCase(),org=await organizationFor(s.userId,id);
 if(org?.role!=='owner')redirect('/dashboard/organizations');
 const c=await db().connect();try{await c.query('BEGIN');const user=(await c.query('SELECT id FROM users WHERE email=$1 AND email_verified_at IS NOT NULL AND deleted_at IS NULL AND suspended_at IS NULL',[email])).rows[0];if(user){const inserted=await c.query("INSERT INTO organization_invites(organization_id,invited_user_id,invited_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id",[id,user.id,s.userId]);if(inserted.rowCount)await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account','Organization invitation','/dashboard/organizations')",[user.id]);}await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}redirect('/dashboard/organizations?msg=If+that+verified+account+exists%2C+an+invitation+is+available+to+them');
}
export async function respondOrganizationInvite(form:FormData) {
 const s=await requireUser(),id=String(form.get('invite_id')??''),accept=form.get('accept')==='1';if(!validId(id))redirect('/dashboard/organizations');
 const c=await db().connect();try{await c.query('BEGIN');const invite=(await c.query("SELECT * FROM organization_invites WHERE id=$1 AND invited_user_id=$2 AND status='pending' FOR UPDATE",[id,s.userId])).rows[0];if(invite){if(accept)await c.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING",[invite.organization_id,s.userId]);await c.query('UPDATE organization_invites SET status=$2 WHERE id=$1',[id,accept?'accepted':'declined']);}await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}redirect('/dashboard/organizations');
}
export async function removeOrganizationMember(form:FormData) {
 const s=await requireUser(),id=String(form.get('organization_id')??''),user=String(form.get('user_id')??''),org=await organizationFor(s.userId,id);
 if(!validId(user)||org?.role!=='owner')redirect('/dashboard/organizations');
 await db().query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role<>'owner'",[id,user]);redirect('/dashboard/organizations');
}
