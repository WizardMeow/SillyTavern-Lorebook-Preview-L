import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  ConfigProvider,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Input,
  Layout,
  Segmented,
  Space,
  Tooltip,
  Typography,
  Tag
} from 'antd';
import { useAtom } from 'jotai';
import { contentRenderModeSchema, type ContentRenderMode, type Lorebook } from './domain/lorebook';
import { importLorebook, isHttpUrl, looksLikeHttpUrl } from './features/import/importer';
import { createLorebookIndex } from './features/reader/lorebook-index';
import { contentRenderModeAtom, lorebookAtom, searchQueryAtom, selectedEntryIdAtom } from './state/lorebook';
import './App.css';

type LoadState = { kind: 'idle' | 'loading' | 'error'; message?: string };

function positionLabel(position: string | number | undefined): string | number | undefined {
  const nativePositions: Record<number, string> = {
    0: '角色定义之前', 1: '角色定义之后', 2: '作者注释顶部', 3: '作者注释底部',
    4: '指定深度', 5: '示例消息之前', 6: '示例消息之后', 7: 'Outlet',
  };
  return typeof position === 'number' ? nativePositions[position] ?? position : position;
}

function entryTitle(entry: Lorebook['entries'][number]) {
  return entry.comment || entry.keys[0] || `条目 ${entry.id}`;
}

function isEditableOrInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="tab"], [role="radio"], [role="textbox"]'));
}

function EntryTriggerHint({ constant, showText = false }: { constant: boolean; showText?: boolean }) {
  const isConstant = constant;
  const title = isConstant
    ? '蓝灯：常驻条目，不需要关键词，会在每次生成时尝试注入。'
    : '黄灯：条件条目，匹配主关键词（及可选次关键词）后才会尝试注入。';
  return <Tooltip title={title}>
    <span className="entry-trigger-hint"><Badge status={isConstant ? 'processing' : 'warning'} text={showText ? (isConstant ? '蓝灯 · 常驻注入' : '黄灯 · 条件注入') : undefined} /></span>
  </Tooltip>;
}

function ContentRenderer({ content, mode }: { content: string; mode: ContentRenderMode }) {
  if (!content) return <Typography.Text type="secondary" italic>此条目没有可显示的 content。</Typography.Text>;
  if (mode === 'text') return <Typography.Paragraph className="entry-content">{content}</Typography.Paragraph>;
  return <div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>;
}

function EntryDetail({ entry, renderMode }: { entry: Lorebook['entries'][number]; renderMode: ContentRenderMode }) {
  const details = [
    entry.position !== undefined ? { key: 'position', label: '注入位置', children: positionLabel(entry.position) } : null,
    entry.order !== undefined ? { key: 'order', label: '排序', children: entry.order } : null,
    entry.depth !== undefined ? { key: 'depth', label: '深度', children: entry.depth } : null,
  ].filter(Boolean);

  return (
    <Space orientation="vertical" size="large" className="detail-stack">
      <Flex justify="space-between" align="flex-start" gap="middle">
        <div>
          <Typography.Text type="secondary">条目 #{entry.id}</Typography.Text>
          <Typography.Title level={2}>{entryTitle(entry)}</Typography.Title>
        </div>
        <Space wrap>
          {entry.disabled && <Badge status="default" text="已禁用" />}
          <EntryTriggerHint constant={entry.constant} showText />
        </Space>
      </Flex>
      <div>
        <Typography.Text type="secondary">主关键词</Typography.Text>
        <div className="tag-group">
          {entry.keys.length ? entry.keys.map((key, index) => <Tag key={`${key}-${index}`}>{key}</Tag>) : <Typography.Text type="secondary">无</Typography.Text>}
        </div>
        {entry.secondaryKeys.length > 0 && <><Typography.Text type="secondary">次要关键词</Typography.Text><div className="tag-group">{entry.secondaryKeys.map((key, index) => <Tag color="blue" key={`${key}-${index}`}>{key}</Tag>)}</div></>}
      </div>
      <Divider />
      <ContentRenderer content={entry.content} mode={renderMode} />
      {details.length > 0 && <Descriptions size="small" column={{ xs: 1, sm: 3 }} items={details} />}
    </Space>
  );
}

const navigationRowHeight = 48;
const navigationOverscan = 6;

function VirtualEntryList({ entries, selectedEntryId, onSelect }: {
  entries: Lorebook['entries'];
  selectedEntryId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const start = Math.max(0, Math.floor(scrollTop / navigationRowHeight) - navigationOverscan);
  const visibleCount = Math.ceil(360 / navigationRowHeight) + navigationOverscan * 2;
  const visibleEntries = entries.slice(start, start + visibleCount);

  useEffect(() => {
    viewport.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [entries]);

  useEffect(() => {
    const selectedIndex = entries.findIndex((entry) => entry.id === selectedEntryId);
    const element = viewport.current;
    if (selectedIndex < 0 || !element) return;

    const top = selectedIndex * navigationRowHeight;
    const bottom = top + navigationRowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight;
  }, [entries, selectedEntryId]);

  const selectAt = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    onSelect(entry.id);

    const element = viewport.current;
    if (!element) return;
    const top = index * navigationRowHeight;
    const bottom = top + navigationRowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const selectedIndex = Math.max(0, entries.findIndex((entry) => entry.id === selectedEntryId));
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectAt(Math.min(entries.length - 1, selectedIndex + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectAt(Math.max(0, selectedIndex - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectAt(entries.length - 1);
    }
  };

  return <div
    ref={viewport}
    className="entry-list-viewport"
    role="listbox"
    tabIndex={0}
    aria-label="世界书条目导航"
    aria-activedescendant={selectedEntryId ? `entry-${selectedEntryId}` : undefined}
    onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    onKeyDown={onKeyDown}
  >
    <div className="entry-list-spacer" style={{ height: entries.length * navigationRowHeight }}>
      {visibleEntries.map((entry, visibleIndex) => {
        const index = start + visibleIndex;
        const selected = entry.id === selectedEntryId;
        return <button
          id={`entry-${entry.id}`}
          key={entry.id}
          className={`entry-list-item${selected ? ' is-selected' : ''}`}
          type="button"
          role="option"
          aria-selected={selected}
          style={{ transform: `translateY(${index * navigationRowHeight}px)` }}
          onClick={() => selectAt(index)}
        >
          <span title={entryTitle(entry)}>{entryTitle(entry)}</span>
          <EntryTriggerHint constant={entry.constant} />
          <Typography.Text type="secondary">#{entry.id}{entry.disabled ? ' · 已禁用' : ''}</Typography.Text>
        </button>;
      })}
    </div>
  </div>;
}

const App = () => {
  const [book, setBook] = useAtom(lorebookAtom);
  const [query, setQuery] = useAtom(searchQueryAtom);
  const [selectedEntryId, setSelectedEntryId] = useAtom(selectedEntryIdAtom);
  const [contentRenderMode, setContentRenderMode] = useAtom(contentRenderModeAtom);
  const [pastedText, setPastedText] = useState('');
  const [isImportExpanded, setIsImportExpanded] = useState(true);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);
  const contentArea = useRef<HTMLDivElement>(null);
  const detailCard = useRef<HTMLDivElement>(null);
  const autoLoadStarted = useRef(false);

  const accept = (next: Lorebook, clearPastedText = false) => {
    setBook(next);
    setQuery('');
    setSelectedEntryId(next.entries[0]?.id ?? null);
    if (clearPastedText) setPastedText('');
    setIsImportExpanded(false);
    setLoadState({ kind: 'idle' });
  };
  const report = (error: unknown) => setLoadState({ kind: 'error', message: error instanceof Error ? error.message : '导入失败。' });
  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setLoadState({ kind: 'loading', message: `正在读取 ${file.name}…` });
    try { accept(await importLorebook({ kind: 'file', file }), true); } catch (error) { report(error); }
  };
  const loadInput = async () => {
    const input = pastedText.trim();
    if (!input) return;
    const isUrl = looksLikeHttpUrl(input);
    setLoadState({ kind: 'loading', message: isUrl ? '正在从 URL 载入…' : '正在解析 JSON…' });
    try {
      accept(await importLorebook({ kind: 'text', value: input }), !isUrl);
    } catch (error) { report(error); }
  };
  const loadDroppedFile = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    void loadFile(event.dataTransfer.files[0]);
  };
  const loadPastedFile = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = event.clipboardData.files[0]
      ?? Array.from(event.clipboardData.items).find((item) => item.kind === 'file')?.getAsFile()
      ?? undefined;
    if (!file) return;
    event.preventDefault();
    void loadFile(file);
  };
  const selectLocalFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    void loadFile(file);
  };
  const openFilePicker = () => fileInput.current?.click();
  const openFilePickerFromContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    openFilePicker();
  };

  useEffect(() => {
    const importUrlParameter = new URLSearchParams(window.location.search).get('url')?.trim();
    if (autoLoadStarted.current || !importUrlParameter || !isHttpUrl(importUrlParameter)) return;

    autoLoadStarted.current = true;
    setPastedText(importUrlParameter);
    setLoadState({ kind: 'loading', message: '正在从 URL 载入…' });
    void importLorebook({ kind: 'text', value: importUrlParameter }).then(accept).catch(report);
  }, []);

  const readerIndex = useMemo(() => book ? createLorebookIndex(book) : null, [book]);
  const deferredQuery = useDeferredValue(query);
  const entries = useMemo(() => readerIndex?.search(deferredQuery) ?? [], [readerIndex, deferredQuery]);
  const selectedCandidate = readerIndex?.get(selectedEntryId);
  const selectedEntry = selectedCandidate && entries.includes(selectedCandidate) ? selectedCandidate : entries[0];

  useEffect(() => {
    if (!selectedEntryId) return;
    detailCard.current?.scrollIntoView({ block: 'start' });
  }, [selectedEntryId]);

  const changeSelectedEntry = (direction: -1 | 1) => {
    if (entries.length === 0) return;
    const selectedIndex = Math.max(0, entries.findIndex((entry) => entry.id === selectedEntry?.id));
    const nextEntry = entries[selectedIndex + direction];
    if (nextEntry) setSelectedEntryId(nextEntry.id);
  };

  const onBackgroundClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || entries.length === 0) return;
    const contentBounds = contentArea.current?.getBoundingClientRect();
    if (!contentBounds) return;

    if (event.clientX < contentBounds.left) changeSelectedEntry(-1);
    else if (event.clientX > contentBounds.right) changeSelectedEntry(1);
  };

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || isEditableOrInteractiveTarget(event.target)
        || entries.length === 0
      ) return;

      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') changeSelectedEntry(1);
      else if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') changeSelectedEntry(-1);
      else if (event.key === 'Home') setSelectedEntryId(entries[0].id);
      else if (event.key === 'End') setSelectedEntryId(entries[entries.length - 1].id);
      else return;

      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [entries, selectedEntry?.id, setSelectedEntryId]);

  return <ConfigProvider theme={{ token: { colorPrimary: '#8b5c31', borderRadius: 10, colorBgLayout: '#f5f2ed', fontFamily: "Inter, 'Noto Sans SC', system-ui, sans-serif" } }}>
    <Layout className="app-layout" onClick={onBackgroundClick}>
      <Layout.Header className="app-header">
        <Typography.Title level={1}>Lorebook Reader</Typography.Title>
        <Typography.Text type="secondary">本地解析 · 无后端 · SillyTavern 世界书预览</Typography.Text>
      </Layout.Header>
      <Layout.Content ref={contentArea} className="app-content">
        <Collapse
          className="import-card"
          activeKey={isImportExpanded ? ['import'] : []}
          onChange={(keys) => setIsImportExpanded(keys.includes('import'))}
          items={[{ key: 'import', label: <span onContextMenu={openFilePickerFromContextMenu}>{book ? '导入或切换世界书' : '导入世界书'}</span>, children: <Space orientation="vertical" size="middle" className="import-stack">
            <Typography.Text type="secondary">粘贴世界书 JSON、快捷回复导出、输入 URL，或将本地 JSON / PNG 角色卡拖入下方输入框。右键标题可直接选择本地文件。</Typography.Text>
            <Input.TextArea
              className="source-input"
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={loadDroppedFile}
              onPaste={loadPastedFile}
              autoSize={{ minRows: 5, maxRows: 12 }}
              placeholder={'粘贴 JSON 或 URL，例如：\nhttps://example.com/world.json'}
            />
            <Space wrap>
              <Button type="primary" loading={loadState.kind === 'loading'} onClick={() => void loadInput()}>载入</Button>
              <Button onClick={openFilePicker}>导入文件</Button>
              <input ref={fileInput} className="sr-only" type="file" accept="application/json,.json,image/png,.png" onChange={selectLocalFile} />
            </Space>
          </Space> }]}
        />
        {loadState.kind !== 'idle' && <Alert className="load-alert" type={loadState.kind === 'error' ? 'error' : 'info'} showIcon message={loadState.message} />}

        {book && <div className="reader-layout">
          <Card className="navigation-card" title={<span>条目导航 <Typography.Text type="secondary">{entries.length} / {book.entries.length}</Typography.Text></span>}>
            <Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} title={book.source}>{book.kind === 'world-info' ? '独立世界书' : book.kind === 'character-card' ? '角色卡内嵌世界书' : '快捷回复'} · {book.name}</Typography.Paragraph>
            <Input.Search value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选关键词、备注或正文" allowClear />
            <Typography.Text type="secondary" className="keyboard-shortcuts">快捷键：↑/↓ 或 J/K 切换条目，Home/End 跳至首尾；点击页面两侧空白处翻页</Typography.Text>
            <Space className="entry-trigger-legend" wrap size="small">
              <EntryTriggerHint constant showText />
              <EntryTriggerHint constant={false} showText />
            </Space>
            {entries.length > 0
              ? <VirtualEntryList entries={entries} selectedEntryId={selectedEntry?.id} onSelect={setSelectedEntryId} />
              : <Empty className="entry-list-empty" description="没有匹配的条目" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {book.warnings.length > 0 && <Alert className="compatibility-alert" type="warning" showIcon message={`${book.warnings.length} 条兼容性提示`} description={<ul>{book.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>} />}
          </Card>
          <Card ref={detailCard} className="detail-card" title="条目详情" extra={<Space size="middle"><Segmented
            size="small"
            options={[{ label: '纯文本', value: 'text' }, { label: 'Markdown', value: 'markdown' }]}
            value={contentRenderMode}
            onChange={(value) => {
              const parsed = contentRenderModeSchema.safeParse(value);
              if (parsed.success) setContentRenderMode(parsed.data);
            }}
          />{selectedEntry ? `#${selectedEntry.id}` : '—'}</Space>}>
            {selectedEntry ? <EntryDetail entry={selectedEntry} renderMode={contentRenderMode} /> : <Empty description="没有匹配的条目" />}
          </Card>
        </div>}
      </Layout.Content>
    </Layout>
  </ConfigProvider>;
};

export default App;
