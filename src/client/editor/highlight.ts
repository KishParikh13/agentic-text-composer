import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const highlightKey = new PluginKey<DecorationSet>('agentHighlight')
export const HIGHLIGHT_FADE_MS = 3000

export function highlightPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: highlightKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        set = set.map(tr.mapping, tr.doc)
        const meta = tr.getMeta('remoteMerge')
        if (meta && meta.to > meta.from)
          set = set.add(tr.doc, [Decoration.inline(meta.from, meta.to, { class: 'agent-highlight' })])
        if (tr.getMeta('clearHighlights')) set = DecorationSet.empty
        return set
      },
    },
    props: { decorations: state => highlightKey.getState(state) },
    view: view => ({
      update(v, prevState) {
        const had = highlightKey.getState(prevState)
        const has = highlightKey.getState(v.state)
        if (has !== had && has && has.find().length)
          setTimeout(() => {
            if (!(v as any).isDestroyed) v.dispatch(v.state.tr.setMeta('clearHighlights', true))
          }, HIGHLIGHT_FADE_MS)
      },
    }),
  })
}
