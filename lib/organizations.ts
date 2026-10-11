import { db } from './db';
import { validId } from './operations';
export async function organizationsFor(userId:string) {
 return (await db().query('SELECT o.id,o.name,m.role FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.name',[userId])).rows as {id:string;name:string;role:string}[];
}
export async function organizationFor(userId:string,id:string) {
 return validId(id)?(await organizationsFor(userId)).find(o=>o.id===id)??null:null;
}
