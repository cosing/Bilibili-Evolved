import { defineComponentMetadata } from '@/components/define'
import { ComponentEntry } from '@/components/types'
import { addVideoActionButton } from '@/components/video/video-actions'
import { videoChange } from '@/core/observer'
import { getUID, matchUrlPattern, mountVueComponent } from '@/core/utils'
import { favoriteListUrls, videoUrls } from '@/core/utils/urls'
import { KeyBindingAction } from '../../utils/keymap/bindings'
import { options, Options } from './options'
import { rbvpNamespaceProvider } from './rbvp-provider'

export const componentName = 'moveFavorite'
export const displayName = '移动收藏'

const entry: ComponentEntry<Options> = async ({ settings }) => {
  if (favoriteListUrls.some(matchUrlPattern) && !settings.options.showInFavoritePages) {
    return
  }
  if (!getUID()) {
    return
  }
  const MoveFavorite = await import('./MoveFavorite.vue')
  const vm: Vue & {
    aid: string
    syncFavoriteState: () => Promise<void>
  } = mountVueComponent(MoveFavorite)
  await addVideoActionButton(() => vm.$el)
  videoChange(() => {
    vm.aid = unsafeWindow.aid
    vm.syncFavoriteState()
  })
}
export const component = defineComponentMetadata({
  name: componentName,
  displayName: '启用移动收藏',
  entry,
  unload: () => {
    dqa('.be-move-favorite').forEach((it: HTMLElement) => (it.style.display = ''))
  },
  reload: () => {
    dqa('.be-move-favorite').forEach((it: HTMLElement) => (it.style.display = 'inline-block'))
  },
  urlInclude: videoUrls,
  tags: [componentsTags.video],
  options,
  plugin: [
    {
      name: `${componentName}.keymap`,
      displayName: `${displayName} - 快捷键支持`,
      setup: ({ addData }) => {
        addData('keymap.actions', (actions: Record<string, KeyBindingAction>) => {
          actions.moveFavorite = {
            displayName,
            run: context => {
              const { clickElement } = context
              return clickElement('.be-move-favorite', context)
            },
          }
        })
        addData('keymap.presets', (presetBase: Record<string, string>) => {
          presetBase.moveFavorite = 'shift m'
        })
      },
    },
    {
      name: `${componentName}.rbvp`,
      displayName: `${displayName} - RBVP 兼容`,
      author: [
        {
          name: 'LainIO24',
          link: 'https://github.com/LainIO24',
        },
      ],
      setup: ({ addData }) => {
        addData('rbvp.namespaces', namespaces => {
          namespaces.moveFavorite = rbvpNamespaceProvider
        })
      },
    },
  ],
})
