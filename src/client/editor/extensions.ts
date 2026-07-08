import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { Markdown } from 'tiptap-markdown'
import { highlightPlugin } from './highlight'

const AgentHighlight = Extension.create({
  name: 'agentHighlight',
  addProseMirrorPlugins: () => [highlightPlugin()],
})

export const buildExtensions = () => [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
  Link.configure({ openOnClick: false }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Markdown.configure({ html: false, tightLists: true, linkify: true, breaks: false }),
  AgentHighlight,
]
