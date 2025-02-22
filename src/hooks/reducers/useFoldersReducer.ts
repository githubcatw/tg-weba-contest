import { getGlobal } from '../../global';

import { ApiMessageEntityTypes, type ApiChatFolder, type ApiSticker } from '../../api/types';
import type { IconName } from '../../types/icons';
import type { Dispatch, StateReducer } from '../useReducer';

import { selectChat } from '../../global/selectors';
import { omit, pick } from '../../util/iteratees';
import useReducer from '../useReducer';
import { buildApiMessageEntity } from '../../api/gramjs/apiBuilders/common';
import { Api } from '../../lib/gramjs';
import parseHtmlAsFormattedText from '../../util/parseHtmlAsFormattedText';
import { buildCustomEmojiHtml } from '../../components/middle/composer/helpers/customEmoji';

export type FolderChatType = {
  icon: IconName;
  title: string;
  key: keyof Pick<ApiChatFolder, (
    'contacts' | 'nonContacts' | 'groups' | 'channels' | 'bots' |
    'excludeMuted' | 'excludeArchived' | 'excludeRead'
  )>;
};

const INCLUDE_FILTER_FIELDS: Array<keyof FolderIncludeFilters> = [
  'includedChatIds', 'bots', 'channels', 'groups', 'contacts', 'nonContacts',
];
const EXCLUDE_FILTER_FIELDS: Array<keyof FolderExcludeFilters> = [
  'excludedChatIds', 'excludeArchived', 'excludeMuted', 'excludeRead',
];

export function selectChatFilters(state: FoldersState, mode: 'included' | 'excluded', selectTemp?: boolean) {
  let selectedChatIds: string[] = [];
  let selectedChatTypes: FolderChatType['key'][] = [];

  if (mode === 'included') {
    const {
      includedChatIds,
      ...includeFilters
    } = selectTemp
      ? state.includeFilters || {}
      : pick(
        state.folder,
        INCLUDE_FILTER_FIELDS,
      );

    selectedChatIds = includedChatIds || [];
    selectedChatTypes = (Object.keys(includeFilters) as Array<keyof typeof includeFilters>)
      .filter((key) => Boolean(includeFilters[key]));
  } else {
    const {
      excludedChatIds,
      ...excludeFilters
    } = selectTemp
      ? state.excludeFilters || {}
      : pick(
        state.folder,
        EXCLUDE_FILTER_FIELDS,
      );

    selectedChatIds = excludedChatIds || [];
    selectedChatTypes = (Object.keys(excludeFilters) as Array<keyof typeof excludeFilters>)
      .filter((key) => Boolean(excludeFilters[key]));
  }

  const global = getGlobal();
  const existingSelectedChatIds = selectedChatIds.filter((id) => selectChat(global, id));

  return {
    selectedChatIds: existingSelectedChatIds,
    selectedChatTypes,
  };
}

function getSuggestedFolderName(includeFilters?: FolderIncludeFilters) {
  if (includeFilters) {
    const {
      includedChatIds,
      ...filters
    } = includeFilters;

    if (
      Object.values(filters).filter(Boolean).length > 1
      || (includedChatIds?.length)
    ) {
      return '';
    }

    if (filters.bots) {
      return 'Bots';
    } else if (filters.groups) {
      return 'Groups';
    } else if (filters.channels) {
      return 'Channels';
    } else if (filters.contacts) {
      return 'Contacts';
    } else if (filters.nonContacts) {
      return 'Non-Contacts';
    }
  }

  return '';
}

type FolderIncludeFilters = Pick<ApiChatFolder, (
  'includedChatIds' | 'bots' | 'channels' | 'groups' | 'contacts' | 'nonContacts'
)>;
type FolderExcludeFilters = Pick<ApiChatFolder, 'excludedChatIds' | 'excludeArchived' | 'excludeMuted' | 'excludeRead'>;

export type FoldersState = {
  mode: 'create' | 'edit';
  isLoading?: boolean;
  isTouched?: boolean;
  error?: string;
  folderId?: number;
  chatFilter: string;
  folder: Omit<ApiChatFolder, 'id' | 'description'>;
  includeFilters?: FolderIncludeFilters;
  excludeFilters?: FolderExcludeFilters;
};
export type FoldersActions = (
  'setTitle' | 'saveFilters' | 'editFolder' | 'reset' | 'setChatFilter' | 'setIsLoading' | 'setError' |
  'editIncludeFilters' | 'editExcludeFilters' | 'setIncludeFilters' | 'setExcludeFilters' | 'setIsTouched' |
  'setFolderId' | 'setIsChatlist' | 'setEmoticon' | 'setCustomEmoticon'
  );
export type FolderEditDispatch = Dispatch<FoldersState, FoldersActions>;

const INITIAL_STATE: FoldersState = {
  mode: 'create',
  chatFilter: '',
  folder: {
    title: { text: '' },
    includedChatIds: [],
    excludedChatIds: [],
  },
};

const foldersReducer: StateReducer<FoldersState, FoldersActions> = (
  state,
  action,
): FoldersState => {
  switch (action.type) {
    case 'setTitle':
      return {
        ...state,
        folder: {
          ...state.folder,
          title: { text: action.payload },
        },
        isTouched: true,
      };
    case 'setEmoticon':
      return {
        ...state,
        folder: {
          ...state.folder,
          emoticon: action.payload.emoji,
          title: action.payload.addToEnd ? { text: state.folder.title.text + action.payload.emoji, ...state.folder } : state.folder.title
        },
        isTouched: true,
      };
    case 'setCustomEmoticon':
      const requestedEmoji = action.payload as ApiSticker;
      // convert the emoji to HTML, then to ApiFormattedText, to convert it into an entity
      const newEmoticonEntities = parseHtmlAsFormattedText(buildCustomEmojiHtml(requestedEmoji)).entities;
      const newEmoticonEntity = newEmoticonEntities ? newEmoticonEntities[0] : undefined;
      const newText = state.folder.title.text + requestedEmoji.emoji;
      // update its offset
      if (newEmoticonEntity) {
        newEmoticonEntity.offset = newText.indexOf(requestedEmoji.emoji!)
      }
      return {
        ...state,
        folder: {
          ...state.folder,
          emoticon: requestedEmoji.emoji,
          title: {
            text: newText,
            entities: state.folder.title.entities && newEmoticonEntity
              // if both exist concatenate the new entity to the old entity list
              ? state.folder.title.entities.concat(newEmoticonEntity)
              // otherwise if only the new entity exists, set it as the entities array
              : (newEmoticonEntity
                ? [newEmoticonEntity]
                // if nothing was generated set the entity list to undefined
                : undefined
              )
          }
        },
        isTouched: true
      };
    case 'setFolderId':
      return {
        ...state,
        folderId: action.payload,
        mode: 'edit',
      };
    case 'editIncludeFilters':
      return {
        ...state,
        includeFilters: pick(
          state.folder,
          INCLUDE_FILTER_FIELDS,
        ),
      };
    case 'editExcludeFilters':
      return {
        ...state,
        excludeFilters: pick(
          state.folder,
          EXCLUDE_FILTER_FIELDS,
        ),
      };
    case 'setIncludeFilters':
      return {
        ...state,
        includeFilters: action.payload,
        chatFilter: '',
      };
    case 'setExcludeFilters':
      return {
        ...state,
        excludeFilters: action.payload,
        chatFilter: '',
      };
    case 'saveFilters':
      if (state.includeFilters) {
        return {
          ...state,
          folder: {
            ...omit(state.folder, INCLUDE_FILTER_FIELDS),
            title: state.folder.title ? state.folder.title : { text: getSuggestedFolderName(state.includeFilters) },
            ...state.includeFilters,
          },
          includeFilters: undefined,
          chatFilter: '',
          isTouched: true,
        };
      } else if (state.excludeFilters) {
        return {
          ...state,
          folder: {
            ...omit(state.folder, EXCLUDE_FILTER_FIELDS),
            ...state.excludeFilters,
          },
          excludeFilters: undefined,
          chatFilter: '',
          isTouched: true,
        };
      } else {
        return state;
      }
    case 'editFolder': {
      const { id: folderId, description, ...folder } = action.payload;

      return {
        mode: 'edit',
        folderId,
        folder,
        chatFilter: '',
      };
    }
    case 'setChatFilter': {
      return {
        ...state,
        chatFilter: action.payload,
      };
    }
    case 'setIsTouched': {
      return {
        ...state,
        isTouched: action.payload,
      };
    }
    case 'setIsLoading': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }
    case 'setError': {
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    }
    case 'setIsChatlist':
      return {
        ...state,
        folder: {
          ...state.folder,
          isChatList: action.payload,
        },
      };
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
};

const useFoldersReducer = () => {
  return useReducer(foldersReducer, INITIAL_STATE);
};

export default useFoldersReducer;
