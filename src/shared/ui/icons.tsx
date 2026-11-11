import type { ComponentType, ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: number;
};

function SvgIcon({
  children,
  size = 18,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

function createIcon(_displayName: string, content: ReactNode) {
  return (props: IconProps) => <SvgIcon {...props}>{content}</SvgIcon>;
}

export const UndoIcon = createIcon(
  'UndoIcon',
  <>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </>,
);

export const RedoIcon = createIcon(
  'RedoIcon',
  <>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </>,
);

export const BoldIcon = createIcon(
  'BoldIcon',
  <>
    <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
    <path d="M7 12h7a4 4 0 0 1 0 8H7z" />
  </>,
);

export const ItalicIcon = createIcon(
  'ItalicIcon',
  <>
    <path d="M10 5h8" />
    <path d="M6 19h8" />
    <path d="m14 5-4 14" />
  </>,
);

export const UnderlineIcon = createIcon(
  'UnderlineIcon',
  <>
    <path d="M7 4v7a5 5 0 0 0 10 0V4" />
    <path d="M5 21h14" />
  </>,
);

export const StrikeIcon = createIcon(
  'StrikeIcon',
  <>
    <path d="M4 12h16" />
    <path d="M7 7a4 4 0 0 1 4-3h3a4 4 0 0 1 3 3" />
    <path d="M7 17a4 4 0 0 0 4 3h3a4 4 0 0 0 3-3" />
  </>,
);

export const CodeIcon = createIcon(
  'CodeIcon',
  <>
    <path d="m8 8-4 4 4 4" />
    <path d="m16 8 4 4-4 4" />
  </>,
);

export const LinkIcon = createIcon(
  'LinkIcon',
  <>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </>,
);

export const UnlinkIcon = createIcon(
  'UnlinkIcon',
  <>
    <path d="M10 13a5 5 0 0 0 6.5.5" />
    <path d="M14 11a5 5 0 0 0-6.5-.5" />
    <path d="M8 5 7 3M4 8 2 7M5 16l-2 1M16 5l2-2M20 8l2-1M19 16l2 1" />
  </>,
);

export const BulletListIcon = createIcon(
  'BulletListIcon',
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
  </>,
);

export const OrderedListIcon = createIcon(
  'OrderedListIcon',
  <>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 5h1v4M4 9h2" />
    <path d="M4 15h2l-2 2h2" />
  </>,
);

export const TaskListIcon = createIcon(
  'TaskListIcon',
  <>
    <rect x="3.5" y="4.5" width="6" height="6" rx="1.2" />
    <path d="m5 7.5 1.2 1.2L8.5 6" />
    <rect x="3.5" y="13.5" width="6" height="6" rx="1.2" />
    <path d="M12.5 7.5h8M12.5 16.5h8" />
  </>,
);

export const QuoteIcon = createIcon(
  'QuoteIcon',
  <>
    <path d="M5 7h5v5H6a4 4 0 0 0 4 4" />
    <path d="M14 7h5v5h-4a4 4 0 0 0 4 4" />
  </>,
);

export const CodeBlockIcon = createIcon(
  'CodeBlockIcon',
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m9 10-2 2 2 2M15 10l2 2-2 2" />
  </>,
);

export const DividerIcon = createIcon(
  'DividerIcon',
  <>
    <path d="M4 12h16" />
    <circle cx="6" cy="7" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="18" cy="7" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="6" cy="17" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="18" cy="17" r="0.8" fill="currentColor" stroke="none" />
  </>,
);

export const TableIcon = createIcon(
  'TableIcon',
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15" />
  </>,
);

export const ClearFormatIcon = createIcon(
  'ClearFormatIcon',
  <>
    <path d="M6 5h12M12 5v9" />
    <path d="m5 19 5-5" />
    <path d="M14 19h6" />
  </>,
);

export const MoreIcon = createIcon(
  'MoreIcon',
  <>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>,
);

export const SourceIcon = createIcon(
  'SourceIcon',
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="m10 13-1.5 1.5L10 16M14 13l1.5 1.5L14 16" />
  </>,
);

export const CopyIcon = createIcon(
  'CopyIcon',
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5H6a2 2 0 0 0-2 2v9" />
  </>,
);

export const DownloadIcon = createIcon(
  'DownloadIcon',
  <>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </>,
);

export const ArrowLeftIcon = createIcon(
  'ArrowLeftIcon',
  <>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </>,
);

export const PlusIcon = createIcon(
  'PlusIcon',
  <>
    <path d="M12 5v14M5 12h14" />
  </>,
);

export const TrashIcon = createIcon(
  'TrashIcon',
  <>
    <path d="M4 7h16" />
    <path d="M9 7V5h6v2" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M10 11v5M14 11v5" />
  </>,
);

export const MergeIcon = createIcon(
  'MergeIcon',
  <>
    <rect x="3" y="4" width="7" height="7" rx="1" />
    <rect x="14" y="4" width="7" height="7" rx="1" />
    <path d="M17.5 4v-1M17.5 11V9" />
    <path d="M8 15v5M5.5 17.5h5M8 20l-2-2m2 2 2-2" />
  </>,
);

export const SplitIcon = createIcon(
  'SplitIcon',
  <>
    <rect x="3" y="4" width="18" height="7" rx="1" />
    <path d="M12 11v4" />
    <path d="M8 20 6 18l2-2M16 20l2-2-2-2" />
    <path d="M6 18h12" />
  </>,
);

export const ChevronDownIcon = createIcon(
  'ChevronDownIcon',
  <path d="m6 9 6 6 6-6" />,
);

export const SearchIcon = createIcon(
  'SearchIcon',
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </>,
);

export const CheckIcon = createIcon('CheckIcon', <path d="m5 12 5 5 9-10" />);

export const CloseIcon = createIcon(
  'CloseIcon',
  <>
    <path d="m6 6 12 12M18 6 6 18" />
  </>,
);

export const RowAboveIcon = createIcon(
  'RowAboveIcon',
  <>
    <rect x="4" y="9" width="16" height="11" rx="1.5" />
    <path d="M4 14h16M12 9v11" />
    <path d="M12 3v4M10 5h4" />
  </>,
);

export const RowBelowIcon = createIcon(
  'RowBelowIcon',
  <>
    <rect x="4" y="4" width="16" height="11" rx="1.5" />
    <path d="M4 9h16M12 4v11" />
    <path d="M12 17v4M10 19h4" />
  </>,
);

export const ColumnLeftIcon = createIcon(
  'ColumnLeftIcon',
  <>
    <rect x="9" y="4" width="11" height="16" rx="1.5" />
    <path d="M14 4v16M9 12h11" />
    <path d="M3 12h4M5 10v4" />
  </>,
);

export const ColumnRightIcon = createIcon(
  'ColumnRightIcon',
  <>
    <rect x="4" y="4" width="11" height="16" rx="1.5" />
    <path d="M9 4v16M4 12h11" />
    <path d="M17 12h4M19 10v4" />
  </>,
);

export const HeaderRowIcon = createIcon(
  'HeaderRowIcon',
  <>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M4 9.5h16" />
    <rect x="4" y="4" width="16" height="5.5" rx="1.5" fill="currentColor" fillOpacity="0.25" />
  </>,
);

function headingIcon(level: number) {
  return createIcon(
    `Heading${level}Icon`,
    <>
      <path d="M5 5v14M13 5v14M5 12h8" />
      <text
        x="18"
        y="16"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        {level}
      </text>
    </>,
  );
}

export const Heading1Icon = headingIcon(1);
export const Heading2Icon = headingIcon(2);
export const Heading3Icon = headingIcon(3);
export const Heading4Icon = headingIcon(4);
export const Heading5Icon = headingIcon(5);

export const FolderIcon = createIcon(
  'FolderIcon',
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
);

export const FileIcon = createIcon(
  'FileIcon',
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </>,
);

export const MenuIcon = createIcon(
  'MenuIcon',
  <>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </>,
);

export const ChevronRightIcon = createIcon(
  'ChevronRightIcon',
  <path d="m9 6 6 6-6 6" />,
);

export const RefreshIcon = createIcon(
  'RefreshIcon',
  <>
    <path d="M20 11a8 8 0 1 0-2.3 6.3" />
    <path d="M20 5v6h-6" />
  </>,
);

export const WarningIcon = createIcon(
  'WarningIcon',
  <>
    <path d="M12 4 2.8 20h18.4z" />
    <path d="M12 10v4" />
    <path d="M12 17.2v.1" />
  </>,
);

export const FolderOpenIcon = createIcon(
  'FolderOpenIcon',
  <>
    <path d="M3 8V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1" />
    <path d="M3 8h17.2a1.6 1.6 0 0 1 1.55 2l-1.9 8.1a2 2 0 0 1-1.95 1.55H5a2 2 0 0 1-2-2z" />
  </>,
);

export const ExpandAllIcon = createIcon(
  'ExpandAllIcon',
  <>
    <path d="m7 9 5-5 5 5" />
    <path d="m7 15 5 5 5-5" />
  </>,
);

export const CollapseAllIcon = createIcon(
  'CollapseAllIcon',
  <>
    <path d="m7 5 5 5 5-5" />
    <path d="m7 19 5-5 5 5" />
  </>,
);

export const SortIcon = createIcon(
  'SortIcon',
  <>
    <path d="M4 7h9M4 12h6M4 17h3" />
    <path d="M18 5v14" />
    <path d="m15 16 3 3 3-3" />
  </>,
);

export const DensityIcon = createIcon(
  'DensityIcon',
  <>
    <path d="M4 5h16M4 19h16" />
    <path d="M12 8v8" />
    <path d="m8.5 11.5 3.5-3.5 3.5 3.5" />
    <path d="m8.5 12.5 3.5 3.5 3.5-3.5" />
  </>,
);

export const SidebarCollapseIcon = createIcon(
  'SidebarCollapseIcon',
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
    <path d="m16 9-3 3 3 3" />
  </>,
);

export const SidebarExpandIcon = createIcon(
  'SidebarExpandIcon',
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
    <path d="m13 9 3 3-3 3" />
  </>,
);

export const ICONS = {
  undo: UndoIcon,
  redo: RedoIcon,
  bold: BoldIcon,
  italic: ItalicIcon,
  underline: UnderlineIcon,
  strike: StrikeIcon,
  code: CodeIcon,
  link: LinkIcon,
  unlink: UnlinkIcon,
  bulletList: BulletListIcon,
  orderedList: OrderedListIcon,
  taskList: TaskListIcon,
  quote: QuoteIcon,
  codeBlock: CodeBlockIcon,
  divider: DividerIcon,
  table: TableIcon,
  clearFormat: ClearFormatIcon,
  more: MoreIcon,
  source: SourceIcon,
  copy: CopyIcon,
  download: DownloadIcon,
  arrowLeft: ArrowLeftIcon,
  plus: PlusIcon,
  trash: TrashIcon,
  merge: MergeIcon,
  split: SplitIcon,
  chevronDown: ChevronDownIcon,
  search: SearchIcon,
  check: CheckIcon,
  close: CloseIcon,
  rowAbove: RowAboveIcon,
  rowBelow: RowBelowIcon,
  columnLeft: ColumnLeftIcon,
  columnRight: ColumnRightIcon,
  headerRow: HeaderRowIcon,
  heading1: Heading1Icon,
  heading2: Heading2Icon,
  heading3: Heading3Icon,
  heading4: Heading4Icon,
  heading5: Heading5Icon,
  folder: FolderIcon,
  folderOpen: FolderOpenIcon,
  file: FileIcon,
  menu: MenuIcon,
  chevronRight: ChevronRightIcon,
  refresh: RefreshIcon,
  warning: WarningIcon,
  expandAll: ExpandAllIcon,
  collapseAll: CollapseAllIcon,
  sort: SortIcon,
  density: DensityIcon,
  sidebarCollapse: SidebarCollapseIcon,
  sidebarExpand: SidebarExpandIcon,
} satisfies Record<string, ComponentType<IconProps>>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = ICONS[name];
  return <Component {...props} />;
}
