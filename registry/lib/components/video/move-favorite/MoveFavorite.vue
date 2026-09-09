<template>
  <span
    v-show="show"
    class="move-favorite be-move-favorite video-toolbar-left-item"
    title="移动收藏"
    :class="{ on: isInTargetFolder, ...displayModeClass }"
    @click.left.self="toggleMove()"
    @click.right.prevent.self="listShowing = !listShowing"
  >
    <i
      class="move-favorite-icon icon"
      @click.left="toggleMove()"
      @click.right.prevent="listShowing = !listShowing"
    ></i>
    <div class="text" @click.left="toggleMove()" @click.right.prevent="listShowing = !listShowing">
      移动收藏
    </div>
    <div ref="selectList" class="select-list" :class="{ show: listShowing }">
      <div v-if="!useRbvp" class="lists">
        选择目标收藏夹:
        <VDropdown
          v-model="selectedTargetList"
          :items="list"
          :key-mapper="it => it.id"
          @change="saveTargetList"
        />
      </div>
      <div v-if="!useRbvp" class="lists-tip">右键点击移动收藏可再次打开</div>
      <div v-else class="lists-tip">
        <i>由 RBVP 接管：{{ selectedTargetList.displayName }}</i>
      </div>
    </div>
    <div class="tip" :class="{ show: tipShowing }">{{ tipText }}</div>
  </span>
</template>
<script lang="ts">
import { addComponentListener, getComponentSettings } from '@/core/settings'
import { BilibiliApiResponse, getJsonWithCredentials } from '@/core/ajax'
import { getUID, getCsrf } from '@/core/utils'
import { logError } from '@/core/utils/log'
import { Toast } from '@/core/toast'
import { VDropdown } from '@/ui'
import { DisplayMode, Options } from './options'
import { componentsMap } from '@/components/component'

const { options } = getComponentSettings('moveFavorite')
interface RawFavoriteListItem {
  id: number
  title: string
  fav_state: number
}
interface FavoriteListItem {
  id: number
  displayName: string
}
const EmptyFavoriteList: FavoriteListItem = {
  id: 0,
  displayName: '<未选择>',
}

export default Vue.extend({
  components: {
    VDropdown,
  },
  data() {
    const { displayMode } = getComponentSettings<Options>('moveFavorite').options
    return {
      show: false,
      aid: unsafeWindow.aid,
      isInTargetFolder: false,
      tipText: '',
      tipShowing: false,
      tipHandle: 0,
      list: [],
      selectedTargetList: EmptyFavoriteList,
      listShowing: false,
      displayMode,
      useRbvp: false,
    }
  },
  computed: {
    displayModeClass() {
      return {
        'icon-only': this.displayMode === DisplayMode.Icon,
        'icon-and-text': this.displayMode === DisplayMode.IconAndText,
      }
    },
  },
  watch: {
    async listShowing(value: boolean) {
      if (value) {
        document.addEventListener('click', e => {
          const el = this.$el as HTMLElement
          const target = e.target as HTMLElement
          if (target !== el && !el.contains(target)) {
            this.listShowing = false
          }
        })
        if (this.list.length === 0) {
          this.loadFavoriteList()
        }
      }
    },
  },
  created() {
    addComponentListener('moveFavorite.displayMode', (value: DisplayMode) => {
      this.displayMode = value
    })
    addComponentListener(
      'moveFavorite.useRbvp',
      (useRbvp: boolean) => {
        this.useRbvp =
          Boolean(componentsMap.rbvp) && getComponentSettings('rbvp').enabled && useRbvp
        if (!this.useRbvp) {
          this.loadSavedList()
          this.show = true
        }
      },
      true,
    )
    addComponentListener('moveFavorite.targetFolderID', () => {
      if (this.useRbvp) {
        this.syncFavoriteState()
        this.show = true
      }
    })
  },
  methods: {
    async loadFavoriteList() {
      try {
        const json = await getJsonWithCredentials(
          `https://api.bilibili.com/medialist/gateway/base/created?pn=1&ps=100&up_mid=${getUID()}&is_space=0`,
        )
        if (json.code !== 0) {
          throw new Error(`获取收藏夹列表失败: ${json.message}`)
        }
        const list: RawFavoriteListItem[] = lodash.get(json, 'data.list', [])
        this.list = list.map(it => ({ id: it.id, displayName: it.title }))
      } catch (error) {
        logError(error)
      }
    },
    async loadSavedList() {
      try {
        const json = await getJsonWithCredentials(
          `https://api.bilibili.com/x/v3/fav/folder/created/list-all?type=2&rid=${
            this.aid
          }&up_mid=${getUID()}`,
        )
        if (json.code !== 0) {
          throw new Error(`获取收藏状态失败: ${json.message}`)
        }

        const list: RawFavoriteListItem[] = lodash.get(json, 'data.list', [])
        const targetFolder = list.find(it => it.id === options.targetFolderID)
        if (targetFolder === undefined) {
          options.targetFolderID = 0
          return
        }
        this.isInTargetFolder = Boolean(targetFolder.fav_state)
        this.selectedTargetList = {
          id: targetFolder.id,
          displayName: targetFolder.title,
        } as FavoriteListItem
      } catch (error) {
        logError(error)
      }
    },
    saveTargetList(list: FavoriteListItem) {
      options.targetFolderID = list.id
      this.syncFavoriteState()
    },
    async syncFavoriteState() {
      if (options.targetFolderID === 0 || !this.aid) {
        return
      }
      try {
        const json = await getJsonWithCredentials(
          `https://api.bilibili.com/x/v3/fav/folder/created/list-all?type=2&rid=${
            this.aid
          }&up_mid=${getUID()}`,
        )
        if (json.code !== 0) {
          throw new Error(`获取收藏状态失败: ${json.message}`)
        }
        const list: { id: number; title: string; fav_state: number }[] = lodash.get(
          json,
          'data.list',
          [],
        )
        const targetFolder = list.find(it => it.id === options.targetFolderID)
        if (targetFolder === undefined) {
          options.targetFolderID = 0
          return
        }
        this.isInTargetFolder = Boolean(targetFolder.fav_state)
        this.selectedTargetList = {
          id: targetFolder.id,
          displayName: targetFolder.title,
        } as FavoriteListItem
      } catch (error) {
        logError(error)
      }
    },
    showTip(text: string) {
      this.tipText = text
      this.tipShowing = true
      if (this.tipHandle) {
        clearTimeout(this.tipHandle)
      }
      this.tipHandle = setTimeout(() => {
        this.tipShowing = false
      }, 2000)
    },
    async toggleMove() {
      if (options.targetFolderID === 0) {
        this.listShowing = true
        return
      }
      await this.moveToTargetFolder()
    },
    async moveToTargetFolder() {
      try {
        // 先获取所有收藏夹状态
        const json = await getJsonWithCredentials(
          `https://api.bilibili.com/x/v3/fav/folder/created/list-all?type=2&rid=${
            this.aid
          }&up_mid=${getUID()}`,
        )
        if (json.code !== 0) {
          throw new Error(`获取收藏状态失败: ${json.message}`)
        }

        const list: RawFavoriteListItem[] = lodash.get(json, 'data.list', [])
        
        // 获取要删除的收藏夹ID列表（除了目标收藏夹外，视频已收藏的其他收藏夹）
        const delMediaIds = list
          .filter(it => it.id !== options.targetFolderID && it.fav_state === 1)
          .map(it => it.id.toString())
          .join(',')

        const formData = {
          rid: this.aid,
          type: 2,
          add_media_ids: options.targetFolderID.toString(),
          del_media_ids: delMediaIds,
          csrf: getCsrf(),
        }

        const request = new Request('https://api.bilibili.com/x/v3/fav/resource/deal', {
          method: 'POST',
          body: Object.entries(formData)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&'),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          credentials: 'include',
        })
        const response: BilibiliApiResponse = await (await fetch(request)).json()
        if (response.code !== 0) {
          throw new Error(response.message)
        }
        
        this.isInTargetFolder = true
        this.showTip(
          `已移动至收藏夹: ${this.selectedTargetList.displayName}`,
        )
      } catch (error) {
        Toast.error(`移动收藏失败: ${error.message}`, '移动收藏')
        console.error(error)
      }
    },
  },
})
</script>
<style lang="scss" scoped>
@import 'common';
@import './font';

.move-favorite {
  margin-right: 28px !important;
  position: relative;
  font-size: 14px;
  width: auto !important;
  .text {
    display: inline;
  }

  @mixin icon-only {
    margin-right: max(calc(min(11vw, 11vh) - 117.2px), 6px) !important;
    .text {
      display: none;
    }
  }
  &.icon-only {
    @include icon-only();
  }
  &:not(.icon-and-text) {
    @media screen and (max-width: 1340px), (max-height: 750px) {
      @include icon-only();
    }
  }

  &-icon {
    font-family: 'quick-favorite' !important;
    font-size: 28px;
    display: inline-block;
    font-style: normal;
    text-align: center;
    text-transform: none;
    line-height: 1;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    @media (min-width: 1681px) {
      font-size: 36px;
    }
    &:after {
      content: '\ea01';
    }
    .video-toolbar-v1 & {
      transform: translateY(1px);
    }
    .video-toolbar-left & {
      margin-right: 8px;
    }
  }
  .tip,
  .select-list {
    line-height: normal;
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    background: #000d;
    padding: 8px;
    border-radius: 4px;
    color: #eee;
    transition: all 0.2s ease-out;
    opacity: 0;
    pointer-events: none;
    &.show {
      opacity: 1;
      pointer-events: initial;
    }
  }
  .select-list {
    @include v-center(8px);
    > * {
      white-space: nowrap;
    }
    .lists-loading {
      padding: 4px 32px;
    }
    .lists {
      @include h-center(8px);
    }
    .lists-tip {
      color: #aaa;
      font-size: 12px;
    }
  }
}
</style>
