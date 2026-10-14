import { uploadDocument } from "@/app/dashboard/documents/actions";
import { DOCUMENT_CATEGORIES, categoryLabel, type DocumentRow } from "@/lib/documents";
export function DocumentUpload({athleteId, document}:{athleteId:string;document?:DocumentRow}) {
 return <details className="upload-details"><summary>{document ? "Upload a new version" : "Upload document"}</summary><form action={uploadDocument} className="operation-form">
  <input type="hidden" name="athlete_id" value={athleteId}/>{document && <input type="hidden" name="document_id" value={document.id}/>}
  <label>Title<input name="title" type="text" maxLength={160} required defaultValue={document?.title}/></label>
  <label>Category<select name="category" defaultValue={document?.category??"other"}>{DOCUMENT_CATEGORIES.map(c=><option key={c} value={c}>{categoryLabel(c)}</option>)}</select></label>
  {!document && <><label>Folder<input type="text" name="folder" maxLength={100}/></label><label>Tags, separated by commas<input type="text" name="tags" maxLength={500}/></label><label>Expires on<input type="date" name="expires_on"/></label></>}
  <label>File · up to 5 MB<input type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" required/></label>
  <p className="muted">PDF previews open here. Modern Office documents include a text preview; download the original for full formatting. New documents are private to the athlete and current guardian.</p>
  <button className="btn" type="submit">{document ? "Save version" : "Upload document"}</button>
 </form></details>;
}
