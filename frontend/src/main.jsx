import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Plus,
  Send,
  Trash2,
  Sparkles,
  Paperclip,
  X,
  Download,
  FileText,
  Folder as FolderIcon,
  Brain,
  Building2,
  BriefcaseBusiness,
  Edit3,
  LayoutGrid,
  List,
  Clock3,
  Settings,
  MoreHorizontal,
  BookmarkPlus,
  FileDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
import { formatMemoryAsReadableText } from './utils/memoryText';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import './styles.css';
import Button from './components/atoms/Button';
import CompanyAutocomplete from './components/molecules/CompanyAutocomplete';
import PopupBackdrop from './components/molecules/PopupBackdrop';
import ImageUpload from './components/molecules/ImageUpload';
import SettingsModal from './components/organisms/SettingsModal';
import JobApplicationsTable from './components/organisms/JobApplicationsTable';
import JobKanbanBoard from './components/organisms/JobKanbanBoard';
import JobAnalysisPage from './components/organisms/JobAnalysisPage';
import JobEditPage from './components/organisms/JobEditPage';
import JobApplicationModal from './components/organisms/JobApplicationModal';
import TailoredResumeBuilder from './components/organisms/TailoredResumeBuilder';
import CoverLetterBuilder from './components/organisms/CoverLetterBuilder';
import MemoryTable from './components/organisms/MemoryTable';
import MemoryEditorModal from './components/molecules/MemoryEditorModal';
import MemoryCaptureModal from './components/molecules/MemoryCaptureModal';
import ResumeProfileModal from './components/organisms/ResumeProfileModal';
import PageLayout from './components/organisms/PageLayout';
import PageBreadcrumb from './components/molecules/PageBreadcrumb';
import { LanguageProvider, useLanguage } from './templates/LanguageProvider';
import { translations } from './i18n/translations';
import SearchInput from './components/atoms/SearchInput';
import Pagination from './components/molecules/Pagination';
import CopyButton from './components/atoms/CopyButton';
import { rehypeCodeHighlight } from './utils/codeHighlight';
import 'highlight.js/styles/monokai.css';
import CompanyLogo from './components/atoms/CompanyLogo';
import ViewToggle from './components/atoms/ViewToggle';
import ActionMenu from './components/molecules/ActionMenu';
import { getAIRequestHeaders, readStoredSettings } from './utils/settings';
import { downloadChatText } from './utils/chatExport';
import { applySort, getNextSortState } from './utils/sortState';
import { compareJobMatchScores } from './utils/jobMatch';
import { textDirection } from './utils/textDirection';
import {
  jobAnalysisPath,
  jobDocumentPath,
  jobIdFromAnalysisPath,
  jobRouteFromPath,
} from './utils/jobAnalysisRoute';
const api = async (url, opt = {}) => {
  const headers = { ...getAIRequestHeaders(), ...(opt.headers || {}) };
  let r = await fetch('/api' + url, { ...opt, headers }),
    d = {};
  try {
    d = await r.json();
  } catch {}
  if (!r.ok) {
    throw Error(d.error || translations.en.requestFailed.replace('{status}', r.status));
  }
  return d;
};
const MemoryTree = ({ node, level, onAdd, onDelete }) => {
  const [expanded, setExpanded] = useState(true);
  const { t } = useLanguage();
  const hasChildren = Boolean(node.children?.length);
  return (
    <div
      className="memory-node"
      dir={textDirection(`${node.name} ${node.content || ''}`)}
      style={{ marginInlineStart: level * 22 }}
    >
      <div className="memory-node-head">
        <span>
          {hasChildren && (
            <Button
              className="tree-toggle"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? t('collapse') : t('expand')}
            >
              {expanded ? '▾' : '▸'}
            </Button>
          )}
          {node.is_leaf ? <FileText size={16} /> : <FolderIcon size={16} />}
          <b>{node.name}</b>
        </span>
        <div>
          <Button onClick={() => onAdd(node.id)} title={t('addChild')}>
            <Plus size={14} />
          </Button>
          <Button
            variant="danger"
            iconOnly
            onClick={() => onDelete(node.id)}
            title={t('delete')}
            aria-label={t('deleteNamed', { name: node.name })}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {node.is_leaf && <p>{node.content}</p>}
      {expanded &&
        node.children?.map((child) => (
          <MemoryTree
            key={child.id}
            node={child}
            level={level + 1}
            onAdd={onAdd}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
};
const getNodeText = (node) => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (node.props?.children) return getNodeText(node.props.children);
  return '';
};
const CodeBlock = ({ children }) => {
  const { t } = useLanguage();
  const code = getNodeText(children).replace(/\n$/, '');
  return (
    <div className="code-block">
      <pre>{children}</pre>
      <CopyButton
        text={code}
        label={t('copyCode')}
        copiedLabel={t('copied')}
        className="code-copy-button"
      />
    </div>
  );
};
const MarkdownMessage = ({ content }) => (
  <div className="markdown" dir={textDirection(content)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeCodeHighlight]}
      components={{ pre: CodeBlock }}
    >
      {content || ''}
    </ReactMarkdown>
  </div>
);
const stepLabel = (message) =>
  (message.content || '')
    .trim()
    .split('\n')[0]
    .replace(/[#>*`~[\]]/g, '')
    .trim()
    .slice(0, 120) || '…';
const responseFiles = (content = '') => {
  const files = [];
  const pattern = /```file\s*:\s*([^\n`]+)\n([\s\S]*?)```/gi;
  let match;
  while ((match = pattern.exec(content))) {
    files.push({ name: match[1].trim(), content: match[2] });
  }
  return files;
};
const downloadFile = (file) => {
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
};
function App() {
  const { t, formatDate, formatDateTime } = useLanguage();
  const locale = 'en-US';
  const [list, setList] = useState([]),
    [active, setActive] = useState(null),
    [model, setModel] = useState(() => readStoredSettings().model || ''),
    [text, setText] = useState(''),
    [files, setFiles] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [memoryView, setMemoryView] = useState(false),
    [memoryItems, setMemoryItems] = useState({ folders: [], memories: [], breadcrumbs: [] }),
    [memoryFolder, setMemoryFolder] = useState(null),
    [selectedMemoryIds, setSelectedMemoryIds] = useState([]),
    [memoryEditor, setMemoryEditor] = useState(null),
    [memorySearch, setMemorySearch] = useState(''),
    [memorySearchItems, setMemorySearchItems] = useState(null),
    [memorySaving, setMemorySaving] = useState(false),
    [arranging, setArranging] = useState(false),
    [browserContext, setBrowserContext] = useState(null),
    [companyView, setCompanyView] = useState(false),
    [companies, setCompanies] = useState([]),
    [companyPage, setCompanyPage] = useState(1),
    [companyPageSize, setCompanyPageSize] = useState(10),
    [companySearch, setCompanySearch] = useState(''),
    [companySort, setCompanySort] = useState({ key: null, direction: null }),
    [selectedCompany, setSelectedCompany] = useState(null),
    [selectedCompanyIds, setSelectedCompanyIds] = useState([]),
    [jobApplications, setJobApplications] = useState([]),
    [selectedJobIds, setSelectedJobIds] = useState([]),
    [jobSearch, setJobSearch] = useState(''),
    [jobView, setJobView] = useState('table'),
    [jobSort, setJobSort] = useState({ key: null, direction: null }),
    [jobModalOpen, setJobModalOpen] = useState(false),
    [analysisJob, setAnalysisJob] = useState(null),
    [analysisSyncing, setAnalysisSyncing] = useState(false),
    [resumeBuilderJob, setResumeBuilderJob] = useState(null),
    [coverLetterJob, setCoverLetterJob] = useState(null),
    [coverLetters, setCoverLetters] = useState([]),
    [activeCoverLetter, setActiveCoverLetter] = useState(null),
    [coverLetterGenerating, setCoverLetterGenerating] = useState(false),
    [coverLetterSaving, setCoverLetterSaving] = useState(false),
    [resumeVersions, setResumeVersions] = useState([]),
    [activeResume, setActiveResume] = useState(null),
    [resumeGenerating, setResumeGenerating] = useState(false),
    [tailoredResumeSaving, setTailoredResumeSaving] = useState(false),
    [resumeProfile, setResumeProfile] = useState(null),
    [resumeProfileOpen, setResumeProfileOpen] = useState(false),
    [resumeSaving, setResumeSaving] = useState(false),
    [editingJobApplication, setEditingJobApplication] = useState(null),
    [jobSaving, setJobSaving] = useState(false),
    [jobCompanyName, setJobCompanyName] = useState(''),
    [jobCompanyId, setJobCompanyId] = useState(''),
    [jobCompanyDescription, setJobCompanyDescription] = useState(''),
    [jobCompanyImage, setJobCompanyImage] = useState(''),
    [companyAddOpen, setCompanyAddOpen] = useState(false),
    [companyEditOpen, setCompanyEditOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [selectionAction, setSelectionAction] = useState(null),
    [memoryCapture, setMemoryCapture] = useState(null),
    [memoryCapturePaths, setMemoryCapturePaths] = useState([]),
    [memoryCaptureSaving, setMemoryCaptureSaving] = useState(false),
    [chatMenu, setChatMenu] = useState(null),
    [route, setRoute] = useState(window.location.pathname);
  const jobEditId = route.startsWith('/job-tracker/edit/') ? route.split('/')[3] : null;
  const jobRoute = jobRouteFromPath(route);
  const jobTrackerView = route === '/job-tracker' || Boolean(jobRoute) || Boolean(jobEditId);
  const [stepScroll, setStepScroll] = useState({ visible: false, open: false, active: -1 });
  const [stickToBottom, setStickToBottom] = useState(true);
  const [scrolledFar, setScrolledFar] = useState(false);
  const userMessages = (active?.messages || []).filter((m) => m.role === 'user');
  const end = useRef(),
    messagesRef = useRef(),
    fileInput = useRef(),
    textInput = useRef();
  useLayoutEffect(() => {
    const input = textInput.current;
    if (!input) return;
    input.style.height = 'auto';
    const style = getComputedStyle(input);
    const maxHeight =
      parseFloat(style.lineHeight) * 7 +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom);
    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [text]);
  useEffect(() => {
    setCompanyPage((page) => Math.min(page, Math.max(1, Math.ceil(companies.length / 10))));
  }, [companies.length]);
  useEffect(() => {
    const closeMenu = () => setChatMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);
  useEffect(() => {
    const showSelectionAction = (event) => {
      if (event.target.closest?.('.selection-memory-action')) return;
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        if (!selectedText || selection.rangeCount === 0) {
          setSelectionAction(null);
          return;
        }
        const range = selection.getRangeAt(0);
        const element =
          range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement;
        if (!element?.closest('.message-body')) {
          setSelectionAction(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        if (!rect.width && !rect.height) {
          setSelectionAction(null);
          return;
        }
        setSelectionAction({
          text: selectedText,
          x: Math.min(window.innerWidth - 16, Math.max(16, rect.left + rect.width / 2)),
          y: Math.max(12, rect.top - 8),
        });
      }, 0);
    };
    const clearSelectionAction = (event) => {
      if (!event.target.closest('.selection-memory-action')) setSelectionAction(null);
    };
    const showTripleClickAction = (event) => {
      if (event.detail === 3 && event.target.closest?.('.message-body')) showSelectionAction(event);
    };
    document.addEventListener('mouseup', showSelectionAction);
    document.addEventListener('touchend', showSelectionAction);
    document.addEventListener('click', showTripleClickAction);
    document.addEventListener('mousedown', clearSelectionAction);
    return () => {
      document.removeEventListener('mouseup', showSelectionAction);
      document.removeEventListener('touchend', showSelectionAction);
      document.removeEventListener('click', showTripleClickAction);
      document.removeEventListener('mousedown', clearSelectionAction);
    };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('browser_context_id');
    if (id) {
      api(`/browser-context/${encodeURIComponent(id)}/`)
        .then((data) => setBrowserContext(data.context))
        .catch((e) => setError(e.message));
      if (params.get('message')) setText(params.get('message'));
    }
  }, []);
  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setRoute(path);
  };
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const loadMemory = async (parentId = memoryFolder) => {
    const suffix = parentId ? `?parent=${encodeURIComponent(parentId)}` : '';
    const data = await api(`/memory/${suffix}`);
    setMemoryFolder(parentId || null);
    setMemoryItems(data);
    setSelectedMemoryIds([]);
  };
  const loadJobApplications = async () => {
    const applications = (await api('/job-applications/')).applications || [];
    setJobApplications(applications);
    return applications;
  };
  const openResumeProfile = async () => {
    setError('');
    try {
      const profile = await api('/resume-profile/');
      setResumeProfile(profile);
      setResumeProfileOpen(true);
    } catch (error) {
      setError(error.message);
    }
  };
  const saveResumeProfile = async (profile) => {
    setResumeSaving(true);
    setError('');
    try {
      const saved = await api('/resume-profile/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      setResumeProfile(saved);
      return true;
    } catch (error) {
      setError(error.message);
      return false;
    } finally {
      setResumeSaving(false);
    }
  };
  const deleteJobApplication = async (id) => {
    if (!window.confirm(t('deleteJobConfirm'))) return;
    try {
      await api(`/job-applications/${id}/`, { method: 'DELETE' });
      setJobApplications((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      setError(error.message);
    }
  };
  const deleteSelectedJobApplications = async () => {
    if (
      !selectedJobIds.length ||
      !window.confirm(t('deleteSelectedJobsConfirm', { count: selectedJobIds.length }))
    )
      return;
    try {
      await Promise.all(
        selectedJobIds.map((id) => api(`/job-applications/${id}/`, { method: 'DELETE' })),
      );
      setJobApplications((items) => items.filter((item) => !selectedJobIds.includes(item.id)));
      setSelectedJobIds([]);
    } catch (error) {
      setError(error.message);
    }
  };
  useEffect(() => {
    if (!memorySearch.trim()) {
      setMemorySearchItems(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await api(`/memory/?q=${encodeURIComponent(memorySearch.trim())}`);
        if (!cancelled) {
          setMemorySearchItems(result);
          setSelectedMemoryIds([]);
        }
      } catch (error) {
        if (!cancelled) setError(error.message);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memorySearch]);
  useEffect(() => {
    let cancelled = false;
    async function loadConversations() {
      try {
        const d = await api('/conversations/');
        if (!cancelled) setList(d.conversations || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }
    loadConversations();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    // Follow new content only while the user is already near the bottom;
    // as soon as they scroll up, streaming no longer yanks the view down.
    if (stickToBottom && end.current) end.current.scrollIntoView({ behavior: 'smooth' });
  }, [active, loading, stickToBottom]);
  // Track whether the user is pinned to the bottom of the chat.
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setStickToBottom(distance < 120);
      setScrolledFar(distance > 1000);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [route, active?.id]);
  // DeepSeek-style step scroll: one dash per user message, active dash follows the viewport.
  useEffect(() => {
    const el = messagesRef.current;
    if (!el || !userMessages.length) return;
    const update = () => {
      const nodes = el.querySelectorAll(':scope > .message.user');
      if (!nodes.length) return;
      const mark = el.getBoundingClientRect().top + el.clientHeight * 0.35;
      let current = 0;
      nodes.forEach((node, index) => {
        if (node.getBoundingClientRect().top <= mark) current = index;
      });
      const visible = el.scrollHeight > el.clientHeight + 80;
      setStepScroll((s) =>
        s.active === current && s.visible === visible ? s : { ...s, active: current, visible },
      );
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [active?.id, userMessages.length, route]);
  const jumpToStep = (index) => {
    messagesRef.current
      ?.querySelectorAll(':scope > .message.user')
      ?.[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const scrollToBottom = () => {
    setStickToBottom(true);
    end.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    if (route === '/chat') {
      setMemoryView(false);
      setCompanyView(false);
      setSelectedCompany(null);
      setActive({ id: null, title: t('newConversation'), messages: [] });
      setText('');
      setError('');
      setFiles([]);
    } else if (route === '/memory') {
      setMemoryView(true);
      setCompanyView(false);
      loadMemory();
    } else if (route === '/job-tracker' || jobIdFromAnalysisPath(route) || jobEditId) {
      setMemoryView(false);
      setCompanyView(false);
      const jobId = jobIdFromAnalysisPath(route);
      loadJobApplications()
        .then((applications) => {
          const selected =
            applications.find((item) => String(item.id) === (jobId || jobEditId)) || null;
          setAnalysisJob(jobId ? selected : null);
          setEditingJobApplication(jobEditId ? selected : null);
          if (selected && jobRoute?.documentType === 'resume') {
            window.history.replaceState({}, '', jobAnalysisPath(selected));
            setRoute(jobAnalysisPath(selected));
            openResumeBuilder(selected);
          } else if (selected && jobRoute?.documentType === 'cover-letter')
            openCoverLetterBuilder(selected, { navigateToPage: false });
          else {
            setResumeBuilderJob(null);
            setCoverLetterJob(null);
          }
          if (selected) {
            setJobCompanyName(selected.company_name || '');
            setJobCompanyId('');
            setJobCompanyDescription(selected.company_description || '');
            setJobCompanyImage(selected.company_image_url || '');
          }
        })
        .catch((error) => setError(error.message));
    } else if (route === '/companies' || route.startsWith('/companies/')) {
      setCompanyView(true);
      setMemoryView(false);
      api('/companies/')
        .then((d) => {
          setCompanies(d.companies || []);
          const id = route.split('/')[2];
          setSelectedCompany(id ? (d.companies || []).find((c) => c.id === id) || null : null);
        })
        .catch((e) => setError(e.message));
    } else if (route.startsWith('/chat/')) {
      setMemoryView(false);
      setCompanyView(false);
      const id = route.split('/')[2];
      if (id && active?.id !== id)
        api(`/conversations/${id}/`)
          .then(setActive)
          .catch((e) => setError(e.message));
    }
  }, [route]);
  const openMemory = () => {
    navigate('/memory');
    setCompanyView(false);
    setMemoryView(true);
    loadMemory(null);
  };
  const openCompanies = async () => {
    navigate('/companies');
    setMemoryView(false);
    setCompanyView(true);
    const data = await api('/companies/');
    setCompanies(data.companies || []);
    setSelectedCompany(null);
    setSelectedCompanyIds([]);
  };
  const fresh = () => {
    navigate('/chat');
    setMemoryView(false);
    setError('');
    setFiles([]);
    setActive({ id: null, title: t('newConversation'), messages: [] });
  };
  const openChat = (c) => {
    navigate(`/chat/${c.id}`);
    setMemoryView(false);
    setCompanyView(false);
    setError('');
    setActive(c);
  };
  const chooseFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    if (files.length + selected.length > 10) {
      setError(t('maxFiles'));
      return;
    }
    setError('');
    setFiles((x) => [...x, ...selected]);
    e.target.value = '';
  };
  const uploadCompanyLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany) return;
    setError('');
    try {
      const form = new FormData();
      form.append('logo', file);
      const updated = await api(`/companies/${selectedCompany.id}/`, {
        method: 'POST',
        body: form,
      });
      setSelectedCompany(updated);
      setCompanies((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setError(error.message);
    } finally {
      e.target.value = '';
    }
  };
  const openMemoryEditor = (type, item = null) => setMemoryEditor({ type, item });
  const saveMemoryItem = async (values) => {
    setMemorySaving(true);
    setError('');
    try {
      const item = memoryEditor?.item;
      await api(item ? `/memory/${item.id}/` : '/memory/', {
        method: item ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, parent_id: item ? undefined : memoryFolder }),
      });
      await loadMemory(null);
      return true;
    } catch (error) {
      setError(error.message);
      return false;
    } finally {
      setMemorySaving(false);
    }
  };
  const downloadMemoryAsText = async (readable = false) => {
    try {
      const data = await api('/memory/export/');
      const content = readable
        ? formatMemoryAsReadableText(data.items)
        : JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = readable ? 'memory-readable.tex' : 'memory-export.mem';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError(error.message);
    }
  };
  const importMemoryFromText = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mem';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.mem')) {
        setError(t('invalidMemoryFile'));
        return;
      }
      try {
        const result = await api('/memory/import/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: await file.text(),
        });
        await loadMemory(memoryFolder);
        alert(t('importMemoryDone', result));
      } catch (error) {
        setError(error.message);
      }
    };
    input.click();
  };
  const cleanMemory = async () => {
    if (!confirm(t('cleanMemoryConfirm'))) return;
    setMemorySaving(true);
    setError('');
    try {
      await api('/memory/bulk/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', all: true, item_ids: ['all'] }),
      });
      await loadMemory(memoryFolder);
      setError(t('cleanMemoryDone'));
    } catch (error) {
      setError(error.message);
    } finally {
      setMemorySaving(false);
    }
  };
  const deleteMemoryItems = async (ids) => {
    if (!ids.length || !confirm(t('deleteMemoryItemsConfirm', { count: ids.length }))) return;
    try {
      await api('/memory/bulk/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', item_ids: ids }),
      });
      await loadMemory(memoryFolder);
    } catch (error) {
      setError(error.message);
    }
  };
  const handleTextChange = (event) => setText(event.target.value);
  const handleTextKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(event);
    }
  };
  const send = async (e) => {
    e?.preventDefault();
    if ((!text.trim() && !files.length) || loading) return;
    let message = text.trim() || t('inspectAttachments'),
      previous = active;
    setText('');
    setError('');
    setLoading(true);
    setStickToBottom(true);
    setActive((a) => ({
      ...(a || { id: null, title: message, messages: [] }),
      messages: [...(a?.messages || []), { role: 'user', content: message }],
    }));
    try {
      const form = new FormData();
      form.append('message', message);
      form.append('model', model);
      if (previous?.id) form.append('conversation_id', previous.id);
      files.forEach((file) => form.append('files', file));
      if (new URLSearchParams(window.location.search).get('browser_context_id'))
        form.append(
          'browser_context_id',
          new URLSearchParams(window.location.search).get('browser_context_id'),
        );
      else if (browserContext) form.append('browser_context', JSON.stringify(browserContext));
      const response = await fetch('/api/chat/', {
        method: 'POST',
        headers: getAIRequestHeaders(),
        body: form,
      });
      if (!response.ok)
        throw Error((await response.text()) || t('requestFailed', { status: response.status }));
      let completed = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const fallback = await response.json();
        if (fallback.error) throw Error(fallback.error);
        completed = fallback;
      } else {
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = '';
        const consume = (line) => {
          if (!line.trim()) return;
          const event = JSON.parse(line);
          if (event.type === 'token') {
            setActive((a) => {
              const messages = a?.messages || [],
                last = messages.at(-1);
              return {
                ...a,
                messages:
                  last?.role === 'assistant'
                    ? [
                        ...messages.slice(0, -1),
                        { role: 'assistant', content: (last.content || '') + event.text },
                      ]
                    : [...messages, { role: 'assistant', content: event.text }],
              };
            });
          } else if (event.type === 'error') throw Error(event.error);
          else if (event.type === 'complete') completed = event;
        };
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) consume(line);
        }
        buffer += decoder.decode();
        if (buffer.trim()) consume(buffer);
      }
      if (!completed) throw Error(t('responseIncomplete'));
      let saved = await api(`/conversations/${completed.conversation_id}/`);
      setActive(saved);
      setList((x) => [saved, ...x.filter((c) => c.id !== saved.id)]);
      setFiles([]);
      setBrowserContext(null);
    } catch (e) {
      setError(e.message);
      setActive((a) => (a ? { ...a, messages: (a.messages || []).slice(0, -1) } : previous));
    } finally {
      setLoading(false);
    }
  };
  const saveNewCompany = async (e, requestClose) => {
    e.preventDefault();
    const form = e.currentTarget;
    setJobSaving(true);
    setError('');
    try {
      const created = await api('/companies/', { method: 'POST', body: new FormData(form) });
      setCompanies((items) => [created, ...items]);
      requestClose();
      form.reset();
    } catch (error) {
      setError(error.message);
    } finally {
      setJobSaving(false);
    }
  };
  const saveCompany = async (e, requestClose) => {
    e.preventDefault();
    const form = e.currentTarget;
    setJobSaving(true);
    setError('');
    try {
      const saved = await api(`/companies/${selectedCompany.id}/`, {
        method: 'POST',
        body: new FormData(form),
      });
      setSelectedCompany(saved);
      setCompanies((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      requestClose();
      form.reset();
    } catch (error) {
      setError(error.message);
    } finally {
      setJobSaving(false);
    }
  };
  const openJobModal = (application = null) => {
    if (application) {
      setEditingJobApplication(application);
      setJobCompanyName(application.company_name || '');
      setJobCompanyId('');
      setJobCompanyDescription(application.company_description || '');
      setJobCompanyImage(application.company_image_url || '');
      setError('');
      window.history.pushState({ jobEdit: true }, '', `/job-tracker/edit/${application.id}`);
      setRoute(`/job-tracker/edit/${application.id}`);
    } else {
      setEditingJobApplication(null);
      setJobCompanyName('');
      setJobCompanyId('');
      setJobCompanyDescription('');
      setJobCompanyImage('');
      setError('');
      setJobModalOpen(true);
    }
  };
  const closeJobModal = () => {
    setJobModalOpen(false);
    setEditingJobApplication(null);
  };
  const closeJobEditPage = () => {
    if (window.history.state?.jobEdit) {
      window.history.back();
    } else {
      navigate(analysisJob ? jobAnalysisPath(analysisJob) : '/job-tracker');
    }
  };
  const openJobAnalysis = (application) => {
    setError('');
    setAnalysisJob(application);
    const path = jobAnalysisPath(application);
    window.history.pushState({ jobAnalysis: true }, '', path);
    setRoute(path);
  };
  const closeJobAnalysis = () => {
    setAnalysisJob(null);
    if (window.history.state?.jobAnalysis) {
      window.history.back();
    } else {
      window.history.replaceState({}, '', '/job-tracker');
      setRoute('/job-tracker');
    }
  };
  const generateCoverLetter = async (instructions, job = coverLetterJob) => {
    if (!job || coverLetterGenerating) return;
    setCoverLetterGenerating(true);
    setError('');
    try {
      const created = await api(`/job-applications/${job.id}/cover-letters/generate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAIRequestHeaders() },
        body: JSON.stringify({ model, instructions }),
      });
      setCoverLetters((items) => [created, ...items.map((x) => ({ ...x, is_current: false }))]);
      setActiveCoverLetter(created);
    } catch (error) {
      setError(error.message);
    } finally {
      setCoverLetterGenerating(false);
    }
  };
  const openCoverLetterBuilder = async (job) => {
    setError('');
    setCoverLetterJob(job);
    setCoverLetters([]);
    setActiveCoverLetter(null);
    try {
      const data = await api(`/job-applications/${job.id}/cover-letters/`);
      const versions = data.cover_letters || [];
      setCoverLetters(versions);
      const current = versions.find((item) => item.is_current) || versions[0] || null;
      setActiveCoverLetter(current);
      if (!current) await generateCoverLetter('', job);
    } catch (error) {
      setError(error.message);
    }
  };
  const renderCoverLetterPdf = useCallback(
    async (draft, signal) => {
      if (!coverLetterJob) throw Error('No cover letter is open.');
      const response = await fetch(
        `/api/job-applications/${coverLetterJob.id}/cover-letters/${draft.id}/pdf/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            ...getAIRequestHeaders(),
          },
          cache: 'no-store',
          signal,
          body: JSON.stringify({
            content: draft.content,
            template_data: draft.template_data || {},
          }),
        },
      );
      if (!response.ok) {
        let result = {};
        try {
          result = await response.json();
        } catch {}
        throw Error(result.error || `PDF rendering failed (${response.status})`);
      }
      return {
        blob: await response.blob(),
        disposition: response.headers.get('Content-Disposition') || '',
      };
    },
    [coverLetterJob],
  );
  const exportCoverLetterPdf = async (draft) => {
    if (!coverLetterJob || coverLetterSaving) return;
    setCoverLetterSaving(true);
    setError('');
    try {
      const { blob, disposition } = await renderCoverLetterPdf(draft);
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plainName = disposition.match(/filename=\"?([^\";]+)\"?/i)?.[1];
      const filename = encodedName
        ? decodeURIComponent(encodedName)
        : plainName ||
          `${coverLetterJob.company_name}-cover-letter-v${draft.version_number}-${Date.now()}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setError(error.message);
    } finally {
      setCoverLetterSaving(false);
    }
  };
  const saveCoverLetter = async (draft) => {
    setCoverLetterSaving(true);
    try {
      const saved = await api(`/job-applications/${coverLetterJob.id}/cover-letters/${draft.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draft.content,
          name: draft.name,
          template_data: draft.template_data || {},
        }),
      });
      setActiveCoverLetter(saved);
      setCoverLetters((items) => items.map((x) => (x.id === saved.id ? saved : x)));
    } catch (error) {
      setError(error.message);
    } finally {
      setCoverLetterSaving(false);
    }
  };
  const deleteCoverLetter = async (id) => {
    if (!confirm('Delete this cover letter version?')) return;
    await api(`/job-applications/${coverLetterJob.id}/cover-letters/${id}/`, { method: 'DELETE' });
    const rest = coverLetters.filter((x) => x.id !== id);
    setCoverLetters(rest);
    setActiveCoverLetter(rest[0] || null);
  };
  const openResumeBuilder = async (job) => {
    setError('');
    setResumeBuilderJob(job);
    try {
      const data = await api(`/job-applications/${job.id}/resumes/`);
      setResumeVersions(data.resumes || []);
      setActiveResume(
        (data.resumes || []).find((item) => item.is_current) || data.resumes?.[0] || null,
      );
    } catch (error) {
      setError(error.message);
    }
  };
  const generateTailoredResume = async (instructions) => {
    if (!resumeBuilderJob || resumeGenerating) return;
    setResumeGenerating(true);
    setError('');
    try {
      const previousResume = activeResume;
      const created = await api(`/job-applications/${resumeBuilderJob.id}/resumes/generate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAIRequestHeaders() },
        body: JSON.stringify({ model, instructions }),
      });
      setResumeVersions((items) => [
        created,
        ...items.map((item) => ({ ...item, is_current: false })),
      ]);
      if (previousResume)
        created.previous_quality_notes =
          previousResume.resume_data?.quality_assessment?.missing_information || [];
      setActiveResume(created);
    } catch (error) {
      setError(error.message);
    } finally {
      setResumeGenerating(false);
    }
  };
  const reassessTailoredResumeQuality = async (draft) => {
    const result = await api(
      `/job-applications/${resumeBuilderJob.id}/resumes/${draft.id}/reassess-quality/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAIRequestHeaders() },
        body: JSON.stringify({ resume_data: draft.resume_data, model }),
      },
    );
    const updated = result.resume;
    setActiveResume(updated);
    setResumeVersions((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    return updated;
  };
  const saveTailoredResume = async (draft) => {
    setTailoredResumeSaving(true);
    setError('');
    try {
      const saved = await api(`/job-applications/${resumeBuilderJob.id}/resumes/${draft.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_data: draft.resume_data,
          page_size: draft.page_size,
          name: draft.name,
        }),
      });
      setActiveResume(saved);
      setResumeVersions((items) => items.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      setError(error.message);
    } finally {
      setTailoredResumeSaving(false);
    }
  };
  const deleteTailoredResume = async (id) => {
    if (!confirm('Delete this resume version?')) return;
    await api(`/job-applications/${resumeBuilderJob.id}/resumes/${id}/`, { method: 'DELETE' });
    const remaining = resumeVersions.filter((item) => item.id !== id);
    setResumeVersions(remaining);
    setActiveResume(remaining[0] || null);
  };
  const downloadTailoredResume = async (draft, placeholders) => {
    if (
      placeholders &&
      !confirm(`This resume contains ${placeholders} unresolved placeholder(s). Export anyway?`)
    )
      return;
    setTailoredResumeSaving(true);
    setError('');
    try {
      const saved = await api(`/job-applications/${resumeBuilderJob.id}/resumes/${draft.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_data: draft.resume_data,
          page_size: draft.page_size,
          name: draft.name,
        }),
      });
      setActiveResume(saved);
      setResumeVersions((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      const link = document.createElement('a');
      link.href = `/api/job-applications/${resumeBuilderJob.id}/resumes/${saved.id}/pdf/?page_size=${saved.page_size}`;
      link.click();
    } catch (error) {
      setError(error.message);
    } finally {
      setTailoredResumeSaving(false);
    }
  };
  const syncJobAnalysis = async () => {
    if (!analysisJob || analysisSyncing) return;
    setAnalysisSyncing(true);
    setError('');
    try {
      const updated = await api(`/job-applications/${analysisJob.id}/analysis/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAIRequestHeaders() },
        body: JSON.stringify({ model, timezone: readStoredSettings().timezone || 'Asia/Tehran' }),
      });
      setAnalysisJob(updated);
      setJobApplications((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setError(error.message);
    } finally {
      setAnalysisSyncing(false);
    }
  };
  const saveJobApplication = async (e, requestClose) => {
    e.preventDefault();
    const form = e.currentTarget;
    setJobSaving(true);
    setError('');
    try {
      const data = new FormData(form);
      if (jobCompanyId) data.append('company_id', jobCompanyId);
      const saved = await api(
        editingJobApplication
          ? `/job-applications/${editingJobApplication.id}/`
          : '/job-applications/',
        { method: 'POST', body: data },
      );
      setJobApplications((items) =>
        editingJobApplication
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      );
      setAnalysisJob((current) => (current?.id === saved.id ? saved : current));
      if (route.startsWith('/job-tracker/edit/')) closeJobEditPage();
      else requestClose();
      setJobCompanyName('');
      setJobCompanyId('');
      setJobCompanyDescription('');
      setJobCompanyImage('');
      form.reset();
    } catch (error) {
      setError(error.message);
    } finally {
      setJobSaving(false);
    }
  };
  const normalizedCompanySearch = companySearch.trim().toLocaleLowerCase(locale);
  const matchingCompanies = normalizedCompanySearch
    ? companies.filter((company) =>
        [
          company.name,
          ...(company.aliases || []),
          company.industry,
          company.location,
          company.website,
        ].some((value) =>
          (value || '').toLocaleLowerCase(locale).includes(normalizedCompanySearch),
        ),
      )
    : companies;
  const sortedCompanies = applySort(matchingCompanies, companySort, (first, second, key) => {
    if (key === 'facts' || key === 'employees')
      return (first[key]?.length || 0) - (second[key]?.length || 0);
    if (key === 'updated')
      return new Date(first.updated_at || 0).getTime() - new Date(second.updated_at || 0).getTime();
    const field = key === 'company' ? 'name' : key;
    return (first[field] || '').localeCompare(second[field] || '', locale, {
      numeric: true,
      sensitivity: 'base',
    });
  });
  const companyPageCount = Math.max(1, Math.ceil(sortedCompanies.length / companyPageSize)),
    pagedCompanies = sortedCompanies.slice(
      (companyPage - 1) * companyPageSize,
      companyPage * companyPageSize,
    );
  const changeCompanySort = (key) => {
    setCompanySort((current) => getNextSortState(current, key));
    setCompanyPage(1);
  };
  const CompanySortIcon = ({ column }) =>
    companySort.key !== column ? (
      <ArrowUpDown size={13} />
    ) : companySort.direction === 'asc' ? (
      <ArrowUp size={13} />
    ) : (
      <ArrowDown size={13} />
    );
  const normalizedJobSearch = jobSearch.trim().toLocaleLowerCase(locale);
  const matchingJobApplications = normalizedJobSearch
    ? jobApplications.filter((application) =>
        [
          application.job_title,
          application.company_name,
          application.company_description,
          application.job_description,
          application.job_post_link,
        ].some((value) => (value || '').toLocaleLowerCase(locale).includes(normalizedJobSearch)),
      )
    : jobApplications;
  const openMemoryCapture = async () => {
    if (!selectionAction?.text) return;
    const capture = { text: selectionAction.text };
    setSelectionAction(null);
    setMemoryCapture(capture);
    try {
      const data = await api('/memory/capture/');
      setMemoryCapturePaths(data.paths || []);
    } catch (error) {
      setError(error.message);
    }
  };
  const saveMemoryCapture = async (values) => {
    setMemoryCaptureSaving(true);
    setError('');
    try {
      await api('/memory/capture/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setMemoryCapturePaths([]);
      window.getSelection()?.removeAllRanges();
      return true;
    } catch (error) {
      setError(error.message);
      return false;
    } finally {
      setMemoryCaptureSaving(false);
    }
  };
  const filteredJobApplications = applySort(
    matchingJobApplications,
    jobSort,
    (first, second, key) => {
      if (key === 'company')
        return first.company_name.localeCompare(second.company_name, locale, {
          numeric: true,
          sensitivity: 'base',
        });
      if (key === 'match') return compareJobMatchScores(first.ai_analysis, second.ai_analysis);
      return new Date(first.created_at || 0).getTime() - new Date(second.created_at || 0).getTime();
    },
  );
  const changeJobSort = (key) => setJobSort((current) => getNextSortState(current, key));
  const sortJobsByPosition = (items) =>
    [...items].sort(
      (first, second) =>
        (first.position || 0) - (second.position || 0) ||
        new Date(second.created_at || 0) - new Date(first.created_at || 0),
    );
  const moveJob = async (application, status, beforeId) => {
    const column = jobApplications.filter(
      (item) => (item.status || 'WATCHLIST') === status && item.id !== application.id,
    );
    let index = beforeId ? column.findIndex((item) => item.id === beforeId) : -1;
    if (index < 0) index = column.length;
    const ids = [
      ...column.slice(0, index).map((item) => item.id),
      application.id,
      ...column.slice(index).map((item) => item.id),
    ];
    if (
      (application.status || 'WATCHLIST') === status &&
      jobApplications
        .filter((item) => (item.status || 'WATCHLIST') === status)
        .map((item) => item.id)
        .join() === ids.join()
    )
      return;
    const previous = jobApplications;
    const positions = new Map(ids.map((id, position) => [id, position]));
    setJobApplications((items) =>
      sortJobsByPosition(
        items.map((item) =>
          positions.has(item.id) ? { ...item, status, position: positions.get(item.id) } : item,
        ),
      ),
    );
    setAnalysisJob((current) =>
      current?.id === application.id ? { ...current, status } : current,
    );
    setError('');
    try {
      await api('/job-applications/reorder/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ids }),
      });
    } catch (error) {
      setJobApplications(previous);
      setError(error.message);
    }
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">
            <Sparkles size={18} />
          </span>
          <b>{t('chat')}</b>
        </div>
        <nav className="sidebar-workspace-nav" aria-label={t('workspace')}>
          <Button className="page-button" onClick={openMemory}>
            <Brain size={16} /> {t('memory')}
          </Button>
          <Button className="page-button" onClick={openCompanies}>
            <Building2 size={16} /> {t('companies')}
          </Button>
          <Button className="page-button" onClick={() => navigate('/job-tracker')}>
            <BriefcaseBusiness size={16} /> {t('jobTracker')}
          </Button>
        </nav>
        <Button className="new" onClick={fresh}>
          <Plus size={18} /> {t('newChat')}
        </Button>
        <label>{t('recentChats')}</label>
        <div className="history">
          {list.map((c) => (
            <div
              className={'row ' + (active?.id === c.id ? 'selected' : '')}
              onClick={() => openChat(c)}
              key={c.id}
            >
              <span>{c.title}</span>
              <div className="chat-menu-wrap">
                <Button
                  className="chat-menu-trigger"
                  iconOnly
                  title={t('chatActions')}
                  aria-label={t('chatActionsNamed', { name: c.title })}
                  aria-haspopup="menu"
                  aria-expanded={chatMenu?.id === c.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const menuWidth = 140,
                      menuHeight = 122,
                      gap = 4;
                    const left = Math.max(
                      8,
                      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
                    );
                    const top =
                      rect.bottom + gap + menuHeight <= window.innerHeight
                        ? rect.bottom + gap
                        : Math.max(8, rect.top - menuHeight - gap);
                    setChatMenu((current) =>
                      current?.id === c.id ? null : { id: c.id, left, top },
                    );
                  }}
                >
                  <MoreHorizontal size={16} />
                </Button>
                {chatMenu?.id === c.id && (
                  <div
                    className="chat-menu"
                    role="menu"
                    style={{ left: chatMenu.left, top: chatMenu.top }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      role="menuitem"
                      onClick={async () => {
                        const title = prompt(t('renameChatPrompt'), c.title)?.trim();
                        if (!title) return;
                        try {
                          const saved = await api(`/conversations/${c.id}/`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title }),
                          });
                          setList((items) =>
                            items.map((item) =>
                              item.id === c.id ? { ...item, title: saved.title } : item,
                            ),
                          );
                          setActive((current) =>
                            current?.id === c.id ? { ...current, title: saved.title } : current,
                          );
                          setChatMenu(null);
                        } catch (error) {
                          setError(error.message);
                        }
                      }}
                    >
                      <Edit3 size={14} />
                      {t('rename')}
                    </Button>
                    <Button
                      role="menuitem"
                      onClick={async () => {
                        try {
                          const conversation =
                            active?.id === c.id ? active : await api(`/conversations/${c.id}/`);
                          downloadChatText(conversation, {
                            user: t('you'),
                            assistant: t('aiAssistant'),
                          });
                          setChatMenu(null);
                        } catch (error) {
                          setError(error.message);
                        }
                      }}
                    >
                      <FileDown size={14} />
                      {t('exportChat')}
                    </Button>
                    <Button
                      className="danger"
                      role="menuitem"
                      onClick={async () => {
                        if (!confirm(t('deleteChatConfirm', { name: c.title }))) return;
                        await api(`/conversations/${c.id}/`, { method: 'DELETE' });
                        setList((items) => items.filter((item) => item.id !== c.id));
                        if (active?.id === c.id) fresh();
                        setChatMenu(null);
                      }}
                    >
                      <Trash2 size={14} />
                      {t('delete')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button className="sidebar-settings" onClick={() => setSettingsOpen(true)}>
          <Settings size={17} /> {t('settings')}
        </Button>
      </aside>
      {coverLetterJob && (
        <CoverLetterBuilder
          fullscreen
          job={coverLetterJob}
          versions={coverLetters}
          activeLetter={activeCoverLetter}
          loading={coverLetterGenerating}
          saving={coverLetterSaving}
          onClose={() => setCoverLetterJob(null)}
          onGenerate={generateCoverLetter}
          onSelect={(id) => setActiveCoverLetter(coverLetters.find((x) => x.id === id) || null)}
          onSave={saveCoverLetter}
          onDelete={deleteCoverLetter}
          onExportPdf={exportCoverLetterPdf}
          onRenderPdf={renderCoverLetterPdf}
        />
      )}{' '}
      {resumeBuilderJob && (
        <TailoredResumeBuilder
          fullscreen
          job={resumeBuilderJob}
          versions={resumeVersions}
          activeResume={activeResume}
          analysis={resumeBuilderJob?.ai_analysis}
          loading={resumeGenerating}
          saving={tailoredResumeSaving}
          onClose={() => setResumeBuilderJob(null)}
          onGenerate={generateTailoredResume}
          onSelect={(id) => setActiveResume(resumeVersions.find((item) => item.id === id) || null)}
          onSave={saveTailoredResume}
          onDelete={deleteTailoredResume}
          onDownload={downloadTailoredResume}
          onReassessQuality={reassessTailoredResumeQuality}
        />
      )}{' '}
      {selectionAction && (
        <Button
          className="selection-memory-action"
          style={{ left: selectionAction.x, top: selectionAction.y }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={openMemoryCapture}
        >
          <BookmarkPlus size={15} />
          {t('addSelectionToMemory')}
        </Button>
      )}
      <MemoryCaptureModal
        capture={memoryCapture}
        paths={memoryCapturePaths}
        saving={memoryCaptureSaving}
        onClose={() => setMemoryCapture(null)}
        onSave={saveMemoryCapture}
      />
      <SettingsModal
        open={settingsOpen}
        currentModel={model}
        onModelChange={setModel}
        onClose={() => setSettingsOpen(false)}
      />
      <main>
        <header>
          <div className="header-title">
            <h1>
              {jobTrackerView
                ? t('jobTracker')
                : memoryView
                  ? t('memory')
                  : companyView
                    ? t('companies')
                    : active?.title || t('newConversation')}
            </h1>
          </div>
        </header>
        {jobTrackerView ? (
          <PageLayout
            className="page job-tracker"
            search={
              !jobEditId && !jobRoute?.documentType && !jobIdFromAnalysisPath(route) ? (
                <SearchInput
                  value={jobSearch}
                  onChange={setJobSearch}
                  label={t('searchJobs')}
                  placeholder={t('searchJobs')}
                />
              ) : null
            }
            actions={
              !jobEditId && !jobRoute?.documentType && !jobIdFromAnalysisPath(route) ? (
                <div className="job-toolbar-actions">
                  <ViewToggle
                    value={jobView}
                    onChange={setJobView}
                    label={t('jobTracker')}
                    options={[
                      {
                        value: 'kanban',
                        label: t('kanbanView'),
                        icon: <LayoutGrid size={16} />,
                      },
                      { value: 'table', label: t('tableView'), icon: <List size={16} /> },
                    ]}
                  />
                  {selectedJobIds.length > 0 && (
                    <span>{t('selectedJobs', { count: selectedJobIds.length })}</span>
                  )}
                  <ActionMenu label={t('actions')}>
                    <Button role="menuitem" variant="ghost" onClick={() => openJobModal()}>
                      <Plus size={16} /> {t('add')}
                    </Button>
                    <Button
                      type="button"
                      role="menuitem"
                      variant="danger"
                      disabled={!selectedJobIds.length}
                      onClick={deleteSelectedJobApplications}
                    >
                      <Trash2 size={16} /> {t('deleteSelected')}
                    </Button>
                  </ActionMenu>
                </div>
              ) : null
            }
          >
            {jobEditId ? (
              <JobEditPage
                job={editingJobApplication}
                error={error}
                saving={jobSaving}
                companyName={jobCompanyName}
                companyDescription={jobCompanyDescription}
                companyImage={jobCompanyImage}
                companyId={jobCompanyId}
                onCompanyName={(value) => {
                  setJobCompanyName(value);
                  setJobCompanyId('');
                }}
                onCompanySelect={(company) => {
                  setJobCompanyName(company.name);
                  setJobCompanyId(company.id);
                  setJobCompanyDescription(company.summary || '');
                  setJobCompanyImage(company.logo_url || '');
                }}
                onDescription={setJobCompanyDescription}
                onBack={closeJobEditPage}
                onSubmit={saveJobApplication}
              />
            ) : jobRoute?.documentType === 'cover-letter' ? (
              <CoverLetterBuilder
                page
                job={coverLetterJob || analysisJob}
                versions={coverLetters}
                activeLetter={activeCoverLetter}
                loading={coverLetterGenerating}
                saving={coverLetterSaving}
                onClose={() => window.history.back()}
                onGenerate={generateCoverLetter}
                onSelect={(id) =>
                  setActiveCoverLetter(coverLetters.find((x) => x.id === id) || null)
                }
                onSave={saveCoverLetter}
                onDelete={deleteCoverLetter}
                onExportPdf={exportCoverLetterPdf}
                onRenderPdf={renderCoverLetterPdf}
              />
            ) : jobIdFromAnalysisPath(route) ? (
              <JobAnalysisPage
                job={analysisJob}
                error={error}
                syncing={analysisSyncing}
                onBack={closeJobAnalysis}
                onSync={syncJobAnalysis}
                onResume={openResumeBuilder}
                onCoverLetter={openCoverLetterBuilder}
                onEdit={openJobModal}
                onRemove={deleteJobApplication}
              />
            ) : (
              <>
                <div className="page-toolbar job-search-toolbar legacy-toolbar">
                  <div className="job-toolbar-actions">
                    <ViewToggle
                      value={jobView}
                      onChange={setJobView}
                      label={t('jobTracker')}
                      options={[
                        {
                          value: 'kanban',
                          label: t('kanbanView'),
                          icon: <LayoutGrid size={16} />,
                        },
                        { value: 'table', label: t('tableView'), icon: <List size={16} /> },
                      ]}
                    />
                    {selectedJobIds.length > 0 && (
                      <span>{t('selectedJobs', { count: selectedJobIds.length })}</span>
                    )}
                    <ActionMenu label={t('actions')}>
                      <Button role="menuitem" variant="ghost" onClick={() => openJobModal()}>
                        <Plus size={16} /> {t('add')}
                      </Button>
                      <Button
                        type="button"
                        role="menuitem"
                        variant="danger"
                        disabled={!selectedJobIds.length}
                        onClick={deleteSelectedJobApplications}
                      >
                        <Trash2 size={16} /> {t('deleteSelected')}
                      </Button>
                    </ActionMenu>
                  </div>
                </div>
                {filteredJobApplications.length ? (
                  jobView === 'kanban' ? (
                    <JobKanbanBoard
                      applications={filteredJobApplications}
                      onMove={moveJob}
                      onEdit={openJobModal}
                      onAnalysis={openJobAnalysis}
                    />
                  ) : (
                    <JobApplicationsTable
                      applications={filteredJobApplications}
                      sort={jobSort}
                      selectedIds={selectedJobIds}
                      onSelectionChange={setSelectedJobIds}
                      onSort={changeJobSort}
                      onEdit={openJobModal}
                      onAnalysis={openJobAnalysis}
                      onDelete={deleteJobApplication}
                    />
                  )
                ) : (
                  <div className="welcome job-empty">
                    <span className="welcome-icon">
                      <BriefcaseBusiness />
                    </span>
                    <h2>{jobSearch.trim() ? t('noMatchingJobs') : t('noJobs')}</h2>
                    <p>{jobSearch.trim() ? t('tryAnotherSearch') : t('noJobsDescription')}</p>
                  </div>
                )}
              </>
            )}
            <JobApplicationModal
              open={jobModalOpen}
              error={error}
              saving={jobSaving}
              companyName={jobCompanyName}
              companyDescription={jobCompanyDescription}
              companyImage={jobCompanyImage}
              companyId={jobCompanyId}
              onCompanyName={(value) => {
                setJobCompanyName(value);
                setJobCompanyId('');
                setJobCompanyDescription('');
                setJobCompanyImage('');
              }}
              onCompanySelect={(company) => {
                setJobCompanyName(company.name);
                setJobCompanyId(company.id);
                setJobCompanyDescription(company.summary || '');
                setJobCompanyImage(company.logo_url || '');
              }}
              onDescription={setJobCompanyDescription}
              onClose={closeJobModal}
              onSubmit={saveJobApplication}
            />
            <ResumeProfileModal
              open={resumeProfileOpen}
              profile={resumeProfile}
              saving={resumeSaving}
              onClose={() => setResumeProfileOpen(false)}
              onSave={saveResumeProfile}
            />
          </PageLayout>
        ) : companyView ? (
          <PageLayout
            className="page memory"
            search={
              !selectedCompany ? (
                <SearchInput
                  value={companySearch}
                  onChange={(value) => {
                    setCompanySearch(value);
                    setCompanyPage(1);
                  }}
                  label={t('searchCompanies')}
                  placeholder={t('searchCompanies')}
                />
              ) : null
            }
          >
            {selectedCompany ? (
              <>
                <div className="page-toolbar">
                  <Button className="toolbar-button" onClick={() => setCompanyEditOpen(true)}>
                    <Edit3 size={16} /> {t('edit')}
                  </Button>
                  <Button
                    className="toolbar-button"
                    variant="danger"
                    onClick={async () => {
                      if (!confirm(t('deleteCompanyConfirm'))) return;
                      try {
                        await api(`/companies/${selectedCompany.id}/`, { method: 'DELETE' });
                        setCompanies((items) =>
                          items.filter((item) => item.id !== selectedCompany.id),
                        );
                        setSelectedCompany(null);
                        navigate('/companies');
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    <Trash2 size={16} /> {t('delete')}
                  </Button>
                  <Button
                    className="toolbar-button"
                    onClick={() => {
                      navigate('/companies');
                      setSelectedCompany(null);
                    }}
                  >
                    <span className="directional-icon">←</span> {t('allCompanies')}
                  </Button>
                </div>
                <article
                  className="company-detail-card company-page"
                  dir={textDirection(`${selectedCompany.name} ${selectedCompany.summary}`)}
                >
                  <div className="company-detail-head">
                    <CompanyLogo
                      name={selectedCompany.name}
                      src={selectedCompany.logo_url}
                      size="large"
                    />
                    <div>
                      <h2>{selectedCompany.name}</h2>
                      <small>{selectedCompany.industry || t('companyProfile')}</small>
                    </div>
                  </div>
                  <p>{selectedCompany.summary || t('noCompanySummary')}</p>
                  {selectedCompany.website && (
                    <p>
                      <b>{t('website')}</b>{' '}
                      <a href={selectedCompany.website} target="_blank" rel="noreferrer">
                        {selectedCompany.website}
                      </a>
                    </p>
                  )}
                  {selectedCompany.linkedin_url && (
                    <p>
                      <b>{t('linkedin')}</b>{' '}
                      <a href={selectedCompany.linkedin_url} target="_blank" rel="noreferrer">
                        {selectedCompany.linkedin_url}
                      </a>
                    </p>
                  )}
                  <h3>{t('companyFacts')}</h3>
                  {selectedCompany.facts?.length ? (
                    selectedCompany.facts.map((f) => (
                      <p key={f.id}>
                        <b>{f.category}:</b> {f.fact}
                        <small>
                          {' '}
                          · {f.source || t('userProvided')} · {f.confidence}
                        </small>
                      </p>
                    ))
                  ) : (
                    <p>{t('noFacts')}</p>
                  )}
                  {selectedCompany.employees?.length > 0 && (
                    <>
                      <h3>{t('employees')}</h3>
                      {selectedCompany.employees.map((e) => (
                        <p key={e.id}>
                          <b>{e.name}</b>
                          {e.title && ` — ${e.title}`}
                          <br />
                          {e.notes}
                          {e.linkedin_url && (
                            <>
                              {' '}
                              ·{' '}
                              <a href={e.linkedin_url} target="_blank" rel="noreferrer">
                                LinkedIn
                              </a>
                            </>
                          )}
                        </p>
                      ))}
                    </>
                  )}
                </article>
                {companyEditOpen && (
                  <PopupBackdrop onClose={() => setCompanyEditOpen(false)}>
                    {(requestClose) => (
                      <div
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="company-edit-title"
                      >
                        <div className="modal-head">
                          <h2 id="company-edit-title">{t('editCompany')}</h2>
                          <Button type="button" onClick={requestClose} aria-label={t('close')}>
                            <X size={18} />
                          </Button>
                        </div>
                        <form
                          onSubmit={(event) => saveCompany(event, requestClose)}
                          className="job-form"
                        >
                          <label>
                            {t('companyName')}
                            <input
                              name="name"
                              required
                              maxLength="200"
                              defaultValue={selectedCompany.name}
                            />
                          </label>
                          <ImageUpload
                            name="logo"
                            label={t('companyImage')}
                            initialPreview={selectedCompany.logo_url}
                          />
                          <label>
                            {t('companyDescription')}
                            <textarea
                              name="summary"
                              rows="6"
                              defaultValue={selectedCompany.summary}
                            />
                          </label>
                          <div className="modal-actions">
                            <Button type="button" onClick={requestClose}>
                              {t('cancel')}
                            </Button>
                            <Button type="submit" disabled={jobSaving}>
                              {jobSaving ? t('saving') : t('save')}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}
                  </PopupBackdrop>
                )}
              </>
            ) : (
              <>
                <div className="company-toolbar legacy-toolbar">
                  <ActionMenu label={t('actions')}>
                    <Button
                      role="menuitem"
                      variant="ghost"
                      onClick={() => {
                        setError('');
                        setCompanyAddOpen(true);
                      }}
                    >
                      <Plus size={16} /> {t('addCompany')}
                    </Button>
                    <Button
                      role="menuitem"
                      variant="ghost"
                      disabled={arranging || selectedCompanyIds.length === 0}
                      onClick={async () => {
                        setArranging(true);
                        setError('');
                        try {
                          const result = await api('/companies/', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ company_ids: selectedCompanyIds }),
                          });
                          setCompanies(result.companies || []);
                          setSelectedCompany(null);
                        } catch (e) {
                          setError(e.message);
                        } finally {
                          setArranging(false);
                        }
                      }}
                    >
                      <Brain size={16} /> {arranging ? t('arranging') : t('arrangement')}
                    </Button>
                    <Button
                      role="menuitem"
                      variant="danger"
                      disabled={selectedCompanyIds.length === 0}
                      onClick={async () => {
                        if (!confirm(t('deleteSelectedCompaniesConfirm'))) return;
                        try {
                          await Promise.all(
                            selectedCompanyIds.map((id) =>
                              api(`/companies/${id}/`, { method: 'DELETE' }),
                            ),
                          );
                          setCompanies((items) =>
                            items.filter((item) => !selectedCompanyIds.includes(item.id)),
                          );
                          setSelectedCompanyIds([]);
                          setSelectedCompany(null);
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      <Trash2 size={16} /> {t('deleteSelectedCompanies')}
                    </Button>
                  </ActionMenu>
                </div>
                {companyAddOpen && (
                  <PopupBackdrop onClose={() => setCompanyAddOpen(false)}>
                    {(requestClose) => (
                      <div
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="company-add-title"
                      >
                        <div className="modal-head">
                          <h2 id="company-add-title">{t('addCompany')}</h2>
                          <Button type="button" onClick={requestClose} aria-label={t('close')}>
                            <X size={18} />
                          </Button>
                        </div>
                        <form
                          onSubmit={(event) => saveNewCompany(event, requestClose)}
                          className="job-form"
                        >
                          <label>
                            {t('companyName')}
                            <input name="name" required maxLength="200" />
                          </label>
                          <ImageUpload name="brand_image" label={t('companyImage')} />
                          <label>
                            {t('aliases')}
                            <input name="aliases" placeholder={t('aliasesExample')} />
                          </label>
                          <label>
                            {t('website')}
                            <input name="website" type="url" placeholder="https://..." />
                          </label>
                          <label>
                            {t('linkedinUrl')}
                            <input
                              name="linkedin_url"
                              type="url"
                              placeholder="https://linkedin.com/company/..."
                            />
                          </label>
                          <label>
                            {t('industry')}
                            <input name="industry" />
                          </label>
                          <label>
                            {t('companySize')}
                            <input name="size" placeholder={t('companySizeExample')} />
                          </label>
                          <label>
                            {t('location')}
                            <input name="location" />
                          </label>
                          <label>
                            {t('companyDescription')}
                            <textarea name="summary" rows="6" />
                          </label>
                          <div className="modal-actions">
                            <Button type="button" onClick={requestClose}>
                              {t('cancel')}
                            </Button>
                            <Button type="submit" disabled={jobSaving}>
                              {jobSaving ? t('saving') : t('save')}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}
                  </PopupBackdrop>
                )}
                <div className="company-table-wrap">
                  <table className="company-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={
                              pagedCompanies.length > 0 &&
                              pagedCompanies.every((company) =>
                                selectedCompanyIds.includes(company.id),
                              )
                            }
                            onChange={(e) =>
                              setSelectedCompanyIds((ids) =>
                                e.target.checked
                                  ? [
                                      ...new Set([
                                        ...ids,
                                        ...pagedCompanies.map((company) => company.id),
                                      ]),
                                    ]
                                  : ids.filter(
                                      (id) => !pagedCompanies.some((company) => company.id === id),
                                    ),
                              )
                            }
                            aria-label={t('selectPage')}
                          />
                        </th>
                        <th>
                          <Button
                            type="button"
                            className="table-sort-button"
                            onClick={() => changeCompanySort('company')}
                            aria-label={t('sortByCompany')}
                            aria-pressed={companySort.key === 'company'}
                          >
                            {t('company')}
                            <CompanySortIcon column="company" />
                          </Button>
                        </th>
                        <th>
                          <Button
                            type="button"
                            className="table-sort-button"
                            onClick={() => changeCompanySort('industry')}
                            aria-label={t('sortByIndustry')}
                            aria-pressed={companySort.key === 'industry'}
                          >
                            {t('industry')}
                            <CompanySortIcon column="industry" />
                          </Button>
                        </th>
                        <th>
                          <Button
                            type="button"
                            className="table-sort-button"
                            onClick={() => changeCompanySort('location')}
                            aria-label={t('sortByLocation')}
                            aria-pressed={companySort.key === 'location'}
                          >
                            {t('location')}
                            <CompanySortIcon column="location" />
                          </Button>
                        </th>
                        <th>
                          <Button
                            type="button"
                            className="table-sort-button"
                            onClick={() => changeCompanySort('facts')}
                            aria-label={t('sortByFacts')}
                            aria-pressed={companySort.key === 'facts'}
                          >
                            {t('facts')}
                            <CompanySortIcon column="facts" />
                          </Button>
                        </th>
                        <th>
                          <Button
                            type="button"
                            className="table-sort-button"
                            onClick={() => changeCompanySort('employees')}
                            aria-label={t('sortByEmployees')}
                            aria-pressed={companySort.key === 'employees'}
                          >
                            {t('employees')}
                            <CompanySortIcon column="employees" />
                          </Button>
                        </th>
                        <th>
                          <Button
                            type="button"
                            className="table-sort-button"
                            onClick={() => changeCompanySort('updated')}
                            aria-label={t('sortByUpdated')}
                            aria-pressed={companySort.key === 'updated'}
                          >
                            {t('updated')}
                            <CompanySortIcon column="updated" />
                          </Button>
                        </th>
                        <th>{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCompanies.map((company) => (
                        <tr
                          key={company.id}
                          onClick={() => {
                            navigate(`/companies/${company.id}`);
                            setSelectedCompany(company);
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedCompanyIds.includes(company.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedCompanyIds((ids) =>
                                  e.target.checked
                                    ? [...new Set([...ids, company.id])]
                                    : ids.filter((id) => id !== company.id),
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td>
                            <span className="table-company">
                              <CompanyLogo name={company.name} src={company.logo_url} />
                              <b>{company.name}</b>
                            </span>
                          </td>
                          <td>{company.industry || '—'}</td>
                          <td>{company.location || '—'}</td>
                          <td>{company.facts?.length || 0}</td>
                          <td>{company.employees?.length || 0}</td>
                          <td>{formatDate(company.updated_at)}</td>
                          <td>
                            <Button
                              type="button"
                              variant="danger"
                              className="table-action-button"
                              aria-label={`${t('delete')} ${company.name}`}
                              title={`${t('delete')} ${company.name}`}
                              onClick={async (event) => {
                                event.stopPropagation();
                                if (!confirm(t('deleteCompanyConfirm'))) return;
                                try {
                                  await api(`/companies/${company.id}/`, { method: 'DELETE' });
                                  setCompanies((items) =>
                                    items.filter((item) => item.id !== company.id),
                                  );
                                  setSelectedCompanyIds((ids) =>
                                    ids.filter((id) => id !== company.id),
                                  );
                                } catch (e) {
                                  setError(e.message);
                                }
                              }}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {matchingCompanies.length > 0 && (
                  <Pagination
                    page={companyPage}
                    pageCount={companyPageCount}
                    pageSize={companyPageSize}
                    onPageChange={setCompanyPage}
                    onPageSizeChange={(size) => {
                      setCompanyPageSize(size);
                      setCompanyPage(1);
                    }}
                    label={t('companyPagination')}
                  />
                )}
              </>
            )}
          </PageLayout>
        ) : memoryView ? (
          <PageLayout
            className="page memory"
            search={
              <SearchInput
                value={memorySearch}
                onChange={setMemorySearch}
                label={t('searchMemories')}
                placeholder={t('searchMemories')}
              />
            }
            actions={
              <ActionMenu label={t('actions')}>
                <Button role="menuitem" variant="ghost" onClick={() => openMemoryEditor('memory')}>
                  <Plus size={16} /> {t('addMemory')}
                </Button>
                <Button role="menuitem" variant="ghost" onClick={() => openMemoryEditor('folder')}>
                  <FolderIcon size={16} /> {t('newMemoryFolder')}
                </Button>
                <Button
                  role="menuitem"
                  variant="ghost"
                  disabled={!memoryItems.folders?.length && !memoryItems.memories?.length}
                  onClick={() => downloadMemoryAsText()}
                >
                  <FileDown size={16} /> {t('exportMemoryAsText')}
                </Button>
                <Button
                  role="menuitem"
                  variant="ghost"
                  disabled={!memoryItems.folders?.length && !memoryItems.memories?.length}
                  onClick={() => downloadMemoryAsText(true)}
                >
                  <FileDown size={16} /> {t('exportMemoryReadable')}
                </Button>
                <Button role="menuitem" variant="ghost" onClick={importMemoryFromText}>
                  <Plus size={16} /> {t('importMemoryFromText')}
                </Button>
                <Button
                  role="menuitem"
                  variant="ghost"
                  disabled={arranging}
                  onClick={async () => {
                    if (!confirm(t('arrangeMemoryConfirm'))) return;
                    setArranging(true);
                    setError('');
                    try {
                      await api('/memory/arrange/', { method: 'POST' });
                      await loadMemory(null);
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setArranging(false);
                    }
                  }}
                >
                  <Brain size={16} /> {arranging ? t('arranging') : t('arrangement')}
                </Button>
                <Button
                  role="menuitem"
                  variant="danger"
                  onClick={cleanMemory}
                >
                  <Trash2 size={16} /> {t('cleanMemory')}
                </Button>
                <Button
                  role="menuitem"
                  variant="danger"
                  disabled={!selectedMemoryIds.length}
                  onClick={() => deleteMemoryItems(selectedMemoryIds)}
                >
                  <Trash2 size={16} /> {t('deleteSelected')}
                </Button>
              </ActionMenu>
            }
          >
            {memoryItems.breadcrumbs?.length > 0 && (
              <PageBreadcrumb items={memoryItems.breadcrumbs} onNavigate={loadMemory} />
            )}
            <div className="memory-toolbar legacy-toolbar">
              <ActionMenu label={t('actions')}>
                <Button role="menuitem" variant="ghost" onClick={() => openMemoryEditor('memory')}>
                  <Plus size={16} /> {t('addMemory')}
                </Button>
                <Button role="menuitem" variant="ghost" onClick={() => openMemoryEditor('folder')}>
                  <FolderIcon size={16} /> {t('newMemoryFolder')}
                </Button>
                <Button
                  role="menuitem"
                  variant="ghost"
                  disabled={!memoryItems.folders?.length && !memoryItems.memories?.length}
                  onClick={() => downloadMemoryAsText()}
                >
                  <FileDown size={16} /> {t('exportMemoryAsText')}
                </Button>
                <Button
                  role="menuitem"
                  variant="ghost"
                  disabled={!memoryItems.folders?.length && !memoryItems.memories?.length}
                  onClick={() => downloadMemoryAsText(true)}
                >
                  <FileDown size={16} /> {t('exportMemoryReadable')}
                </Button>
                <Button role="menuitem" variant="ghost" onClick={importMemoryFromText}>
                  <Plus size={16} /> {t('importMemoryFromText')}
                </Button>
                <Button
                  role="menuitem"
                  variant="ghost"
                  disabled={arranging}
                  onClick={async () => {
                    if (!confirm(t('arrangeMemoryConfirm'))) return;
                    setArranging(true);
                    setError('');
                    try {
                      await api('/memory/arrange/', { method: 'POST' });
                      await loadMemory(null);
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setArranging(false);
                    }
                  }}
                >
                  <Brain size={16} /> {arranging ? t('arranging') : t('arrangement')}
                </Button>
                <Button
                  role="menuitem"
                  variant="danger"
                  onClick={cleanMemory}
                >
                  <Trash2 size={16} /> {t('cleanMemory')}
                </Button>
                <Button
                  role="menuitem"
                  variant="danger"
                  disabled={!selectedMemoryIds.length}
                  onClick={() => deleteMemoryItems(selectedMemoryIds)}
                >
                  <Trash2 size={16} /> {t('deleteSelected')}
                </Button>
              </ActionMenu>
            </div>
            <MemoryTable
              folders={(memorySearchItems ?? memoryItems).folders || []}
              memories={(memorySearchItems ?? memoryItems).memories || []}
              selectedIds={selectedMemoryIds}
              onSelectionChange={setSelectedMemoryIds}
              onOpenFolder={loadMemory}
              onEdit={(item) => openMemoryEditor(item.is_leaf ? 'memory' : 'folder', item)}
              onDelete={deleteMemoryItems}
            />
            <MemoryEditorModal
              type={memoryEditor?.type}
              item={memoryEditor?.item}
              saving={memorySaving}
              onClose={() => setMemoryEditor(null)}
              onSave={saveMemoryItem}
            />
          </PageLayout>
        ) : (
          <>
            <section className="messages" ref={messagesRef}>
              {!active?.messages?.length ? (
                <div className="welcome">
                  <span className="welcome-icon">
                    <Sparkles />
                  </span>
                  <h2>{t('welcomeTitle')}</h2>
                  <p>{t('welcomeDescription')}</p>
                </div>
              ) : (
                active.messages.map((m, i) => (
                  <div className={'message ' + m.role} key={i}>
                    <div className="message-content">
                      <div className="message-body">
                        <MarkdownMessage content={m.content} />
                        {m.role === 'assistant' &&
                          responseFiles(m.content).map((file, index) => (
                            <Button
                              className="download-file"
                              key={index}
                              onClick={() => downloadFile(file)}
                            >
                              <Download size={14} /> {t('downloadFile', { name: file.name })}
                            </Button>
                          ))}
                      </div>
                      <div className="message-copy-row">
                        <CopyButton
                          text={m.content}
                          label={t('copyMessage')}
                          copiedLabel={t('copied')}
                        />
                        {m.created_at && (
                          <time className="message-time" dateTime={m.created_at}>
                            {formatDateTime(m.created_at)}
                          </time>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="message assistant">
                  <div>
                    <p className="typing">● ● ●</p>
                  </div>
                </div>
              )}
              <div ref={end} />
            </section>
            {userMessages.length > 0 && stepScroll.visible && (
              <div
                className={'step-scrollbar' + (stepScroll.open ? ' open' : '')}
                onMouseEnter={() => setStepScroll((s) => ({ ...s, open: true }))}
                onMouseLeave={() => setStepScroll((s) => ({ ...s, open: false }))}
              >
                <div className="step-scrollbar-panel" role="navigation">
                  {userMessages.map((m, i) => {
                    const label = stepLabel(m);
                    return (
                      <button
                        key={i}
                        type="button"
                        className={i === stepScroll.active ? 'active' : ''}
                        onClick={() => jumpToStep(i)}
                        title={label}
                      >
                        <span dir={textDirection(label)}>{label}</span>
                        <i aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
                <div className="step-scrollbar-rail">
                  {userMessages.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      className={'step-scrollbar-dash' + (i === stepScroll.active ? ' active' : '')}
                      onClick={() => jumpToStep(i)}
                      aria-label={stepLabel(m)}
                      title={stepLabel(m)}
                    />
                  ))}
                </div>
              </div>
            )}
            {error && <div className="error">{error}</div>}
            {scrolledFar && (
              <button
                type="button"
                className="scroll-to-bottom"
                onClick={scrollToBottom}
                aria-label={t('scrollToBottom')}
                title={t('scrollToBottom')}
              >
                <ChevronDown size={18} />
              </button>
            )}
            <form onSubmit={send} className="composer">
              <input ref={fileInput} type="file" multiple hidden onChange={chooseFiles} />
              {browserContext && (
                <span className="mention-chip browser-chip">
                  🌐 {browserContext.title || browserContext.url}
                  <Button type="button" onClick={() => setBrowserContext(null)}>
                    <X size={13} />
                  </Button>
                </span>
              )}
              <div className="composer-input-wrap">
                <div className="input">
                  <Button
                    type="button"
                    className="attach"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Paperclip size={18} />
                  </Button>
                  <textarea
                    ref={textInput}
                    dir={textDirection(text)}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleTextKeyDown}
                    placeholder={t('messagePlaceholder')}
                    rows="1"
                  />
                  <Button type="submit" disabled={(!text.trim() && !files.length) || loading}>
                    <Send size={17} />
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>,
);
