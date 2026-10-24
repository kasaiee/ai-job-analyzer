import React, {useState} from 'react';
import {ArrowDown,ArrowUp,ArrowUpDown,Edit3,FileText,Folder,FolderInput,Trash2} from 'lucide-react';
import Button from '../atoms/Button';
import {useLanguage} from '../../templates/LanguageProvider';

const MemoryTable=({folders,memories,selectedIds,onSelectionChange,onOpenFolder,onEdit,onMove,onDelete})=>{
  const {t,formatDate}=useLanguage();const [sort,setSort]=useState({key:'name',direction:'asc'});const items=[...folders,...memories];
  const sorted=[...items].sort((a,b)=>{if(a.is_leaf!==b.is_leaf)return a.is_leaf?1:-1;const result=sort.key==='name'?a.name.localeCompare(b.name):new Date(a.updated_at)-new Date(b.updated_at);return sort.direction==='asc'?result:-result});
  const allSelected=items.length>0&&items.every(item=>selectedIds.includes(item.id));
  const toggle=id=>onSelectionChange(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const changeSort=key=>setSort(current=>({key,direction:current.key===key&&current.direction==='asc'?'desc':'asc'}));
  const SortIcon=({column})=>sort.key!==column?<ArrowUpDown size={13}/>:sort.direction==='asc'?<ArrowUp size={13}/>:<ArrowDown size={13}/>;
  return <div className="memory-table-wrap"><table className="memory-table"><thead><tr><th><input type="checkbox" checked={allSelected} onChange={event=>onSelectionChange(event.target.checked?items.map(item=>item.id):[])} aria-label={t('selectAllMemory')}/></th><th><Button className="table-sort-button" onClick={()=>changeSort('name')}>{t('name')}<SortIcon column="name"/></Button></th><th>{t('description')}</th><th><Button className="table-sort-button" onClick={()=>changeSort('date')}>{t('updated')}<SortIcon column="date"/></Button></th><th>{t('actions')}</th></tr></thead><tbody>{sorted.map(item=><tr key={item.id} className={!item.is_leaf?'memory-folder-row':''} onDoubleClick={()=>!item.is_leaf&&onOpenFolder(item.id)}><td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={()=>toggle(item.id)} aria-label={t('selectNamed',{name:item.name})}/></td><td><span className="memory-table-name">{item.is_leaf?<FileText size={18}/>:<Folder size={18}/>}<b>{item.name}</b></span></td><td><span className="memory-content-preview">{item.is_leaf?item.content:'—'}</span></td><td>{formatDate(item.updated_at)}</td><td><span className="memory-row-actions">{!item.is_leaf&&<Button title={t('openFolder')} onClick={()=>onOpenFolder(item.id)}><FolderInput size={15}/></Button>}<Button title={t('edit')} onClick={()=>onEdit(item)}><Edit3 size={15}/></Button><Button title={t('move')} onClick={()=>onMove([item.id])}><FolderInput size={15}/></Button><Button variant="danger" iconOnly title={t('delete')} onClick={()=>onDelete([item.id])}><Trash2 size={15}/></Button></span></td></tr>)}</tbody></table>{!items.length&&<p className="drive-list-empty">{t('emptyMemoryFolder')}</p>}</div>;
};
export default MemoryTable;
