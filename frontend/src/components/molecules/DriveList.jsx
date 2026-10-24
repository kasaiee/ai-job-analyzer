import React, {useEffect, useState} from 'react';
import {ArrowDown, ArrowUp, ArrowUpDown, Clock3, Download, FilePenLine, Folder as FolderIcon, LayoutGrid, List, Plus, Trash2} from 'lucide-react';
import Button from '../atoms/Button';
import FileTypeIcon, {isImageFile, isPdfFile} from '../atoms/FileTypeIcon';
import ViewToggle from '../atoms/ViewToggle';
import {useLanguage} from '../../templates/LanguageProvider';

const FilePreview = ({file, t}) => (
  <div className="drive-file-preview">
    {isImageFile(file) ? <img src={file.url} alt=""/> : isPdfFile(file) ? (
      <iframe className="drive-pdf-preview" src={`${file.url}#page=1&toolbar=0&navpanes=0&scrollbar=0`} title={t('firstPagePreview', {name: file.name})} tabIndex="-1" scrolling="no"/>
    ) : <><FileTypeIcon file={file} size={34}/><p>{file.extracted_text || t('noTextPreview')}</p></>}
  </div>
);

const DriveActions = ({file, onAddToChat, onDescribe, onDownload, onDelete, t}) => (
  <span className="drive-actions">
    <Button type="button" title={t('addToChat')} aria-label={t('addNamedToChat', {name: file.name})} onClick={event => {event.stopPropagation(); onAddToChat(file)}}><Plus size={16}/></Button>
    <Button type="button" title={t('download')} aria-label={t('downloadNamed', {name: file.name})} onClick={event => {event.stopPropagation(); onDownload(file)}}><Download size={16}/></Button>
    <Button type="button" title={t('editDescription')} aria-label={t('describeNamed', {name: file.name})} onClick={event => {event.stopPropagation(); onDescribe(file, 'file')}}><FilePenLine size={16}/></Button>
    <Button type="button" variant="danger" iconOnly title={t('delete')} aria-label={t('deleteNamed', {name: file.name})} onClick={event => {event.stopPropagation(); onDelete(file)}}><Trash2 size={16}/></Button>
  </span>
);

const DriveList = ({folders, files, view, onViewChange, onOpenFolder, onSelectFile, onAddFolderToChat, onDescribe, onBulkAddToChat, onDownload, onDeleteFolder, onDeleteFile, onBulkDelete}) => {
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [sort, setSort] = useState({key: 'name', direction: 'asc'});
  const {language, t, formatDate} = useLanguage();
  const locale = language === 'fa' ? 'fa-IR' : 'en-US';
  const formatFileTime = createdAt => createdAt ? formatDate(createdAt) : t('unknownDate');

  useEffect(() => {
    const availableIds = new Set(files.map(file => file.id));
    setSelectedFileIds(ids => ids.filter(id => availableIds.has(id)));
  }, [files]);

  useEffect(() => {
    const availableIds = new Set(folders.map(folder => folder.id));
    setSelectedFolderIds(ids => ids.filter(id => availableIds.has(id)));
  }, [folders]);

  const selectedFiles = files.filter(file => selectedFileIds.includes(file.id));
  const selectedFolders = folders.filter(folder => selectedFolderIds.includes(folder.id));
  const selectedCount = selectedFiles.length + selectedFolders.length;
  const itemCount = files.length + folders.length;
  const sortItems = items => [...items].sort((first, second) => {
    const result = sort.key === 'name'
      ? first.name.localeCompare(second.name, locale, {numeric: true, sensitivity: 'base'})
      : (new Date(first.created_at || 0).getTime() - new Date(second.created_at || 0).getTime());
    return sort.direction === 'asc' ? result : -result;
  });
  const sortedFiles = sortItems(files);
  const sortedFolders = sortItems(folders);
  const changeSort = key => setSort(current => ({key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'}));
  const SortIcon = ({column}) => sort.key !== column ? <ArrowUpDown size={13}/> : sort.direction === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>;
  const toggleFile = fileId => setSelectedFileIds(ids => ids.includes(fileId) ? ids.filter(id => id !== fileId) : [...ids, fileId]);
  const toggleFolder = folderId => setSelectedFolderIds(ids => ids.includes(folderId) ? ids.filter(id => id !== folderId) : [...ids, folderId]);
  const toggleAll = event => {
    const checked = event.target.checked;
    setSelectedFileIds(checked ? files.map(file => file.id) : []);
    setSelectedFolderIds(checked ? folders.map(folder => folder.id) : []);
  };
  const addSelectedToChat = () => { onBulkAddToChat(selectedFiles); setSelectedFileIds([]); };
  const deleteSelected = async () => { if (await onBulkDelete(selectedFiles, selectedFolders)) {setSelectedFileIds([]); setSelectedFolderIds([]);} };

  return <>
    <div className="drive-controls">
      <ViewToggle value={view} onChange={onViewChange} label={t('driveView')} options={[
        {value: 'cards', label: t('cards'), icon: <LayoutGrid size={16}/>},
        {value: 'list', label: t('list'), icon: <List size={16}/>},
      ]}/>
      <div className="drive-bulk-actions">
        {selectedCount > 0 && <span>{t('selected', {count: selectedCount.toLocaleString(locale)})}</span>}
        <Button type="button" disabled={!selectedFiles.length} onClick={addSelectedToChat}><Plus size={16}/> {t('addToChat')}</Button>
        <Button type="button" variant="danger" disabled={!selectedCount} onClick={deleteSelected}><Trash2 size={16}/> {t('delete')}</Button>
      </div>
    </div>
    <div className={view === 'cards' ? 'drive-cards' : 'drive-list'} role="list" aria-label={t('driveFiles')}>
      {view === 'list' && <div className="drive-list-header"><input ref={input => {if(input)input.indeterminate=selectedCount>0&&selectedCount<itemCount}} className="drive-file-checkbox" type="checkbox" checked={itemCount>0&&selectedCount===itemCount} disabled={!itemCount} onChange={toggleAll} aria-label={t('selectAll')}/><Button type="button" className="drive-sort-button" onClick={() => changeSort('name')} aria-label={t('sortByName')} aria-pressed={sort.key === 'name'}>{t('name')}<SortIcon column="name"/></Button><Button type="button" className="drive-sort-button" onClick={() => changeSort('date')} aria-label={t('sortByDate')} aria-pressed={sort.key === 'date'}>{t('added')}<SortIcon column="date"/></Button><span className="drive-actions-heading">{t('actions')}</span></div>}
      {(view === 'list' ? sortedFolders : folders).map(folder => view === 'cards' ? (
        <article className="drive-card folder-card" key={folder.id} role="button" tabIndex="0" onDoubleClick={() => onOpenFolder(folder.id)} onKeyDown={event=>{if(event.key==='Enter'){onOpenFolder(folder.id)}}} title={t('openFolder')}>
          <span className="drive-card-icon"><FolderIcon size={28} strokeWidth={1.8}/></span><span className="drive-card-name">{folder.name}</span>{folder.description&&<span className="drive-item-description">{folder.description}</span>}<small>{t('folder')}</small><span className="folder-card-actions"><Button type="button" title={t('addFolderToChat')} aria-label={t('addFolderNamedToChat',{name:folder.name})} onClick={event=>{event.stopPropagation();onAddFolderToChat(folder)}}><Plus size={15}/></Button><Button type="button" title={t('editDescription')} aria-label={t('describeNamed',{name:folder.name})} onClick={event=>{event.stopPropagation();onDescribe(folder,'folder')}}><FilePenLine size={15}/></Button></span>
        </article>
      ) : (
        <div className="drive-list-row drive-folder-row" key={folder.id} role="button" tabIndex="0" onDoubleClick={() => onOpenFolder(folder.id)} onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onOpenFolder(folder.id);}}} title={t('openFolder')}>
          <input className="drive-file-checkbox" type="checkbox" checked={selectedFolderIds.includes(folder.id)} onChange={() => toggleFolder(folder.id)} onClick={event => event.stopPropagation()} aria-label={t('selectNamed', {name: folder.name})}/><span className="drive-list-main"><FolderIcon className="drive-list-icon folder-icon" size={20}/><span className="drive-list-label"><span className="drive-list-name">{folder.name}</span>{folder.description&&<small>{folder.description}</small>}</span></span><span className="drive-list-type"><Clock3 size={14}/> {formatFileTime(folder.created_at)}</span>
          <span className="drive-actions"><Button type="button" title={t('addFolderToChat')} aria-label={t('addFolderNamedToChat',{name:folder.name})} onClick={event=>{event.stopPropagation();onAddFolderToChat(folder)}}><Plus size={16}/></Button><Button type="button" title={t('editDescription')} aria-label={t('describeNamed',{name:folder.name})} onClick={event=>{event.stopPropagation();onDescribe(folder,'folder')}}><FilePenLine size={16}/></Button><Button type="button" variant="danger" iconOnly title={t('delete')} aria-label={t('deleteNamed', {name: folder.name})} onClick={event => {event.stopPropagation(); onDeleteFolder(folder)}}><Trash2 size={16}/></Button></span>
        </div>
      ))}
      {(view === 'list' ? sortedFiles : files).map(file => view === 'cards' ? (
        <article className="drive-card file-card" key={file.id} role="listitem">
          <input className="drive-file-checkbox" type="checkbox" checked={selectedFileIds.includes(file.id)} onChange={() => toggleFile(file.id)} aria-label={t('selectNamed', {name: file.name})}/>
           <div className="drive-card-content"><FilePreview file={file} t={t}/><strong className="drive-card-name">{file.name}</strong>{file.description&&<span className="drive-item-description">{file.description}</span>}<small><Clock3 size={13}/> {formatFileTime(file.created_at)}</small></div>
           <DriveActions file={file} onAddToChat={onSelectFile} onDescribe={onDescribe} onDownload={onDownload} onDelete={onDeleteFile} t={t}/>
        </article>
      ) : (
        <div className="drive-list-row" key={file.id} role="listitem">
          <input className="drive-file-checkbox" type="checkbox" checked={selectedFileIds.includes(file.id)} onChange={() => toggleFile(file.id)} aria-label={t('selectNamed', {name: file.name})}/>
           <div className="drive-list-main"><FileTypeIcon file={file} className="drive-list-icon" size={20}/><span className="drive-list-label"><span className="drive-list-name">{file.name}</span>{file.description&&<small>{file.description}</small>}</span></div><span className="drive-list-type"><Clock3 size={14}/> {formatFileTime(file.created_at)}</span>
           <DriveActions file={file} onAddToChat={onSelectFile} onDescribe={onDescribe} onDownload={onDownload} onDelete={onDeleteFile} t={t}/>
        </div>
      ))}
      {!folders.length && !files.length && <p className="drive-list-empty">{t('emptyFolder')}</p>}
    </div>
  </>;
};

export default DriveList;
