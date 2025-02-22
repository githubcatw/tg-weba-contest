import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo,
  useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import type { IconName } from '../../types/icons';
import type {
  EmojiData,
  EmojiModule,
  EmojiRawData,
} from '../../util/emoji/emoji';

import { MENU_TRANSITION_DURATION, RECENT_SYMBOL_SET_ID, FOLDER_SYMBOL_SET_ID, FOLDER_ICON_EMOJI, STICKER_PICKER_MAX_SHARED_COVERS, STICKER_SIZE_PICKER_HEADER } from '../../config';
import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import animateScroll from '../../util/animateScroll';
import buildClassName from '../../util/buildClassName';
import { uncompressEmoji } from '../../util/emoji/emoji';
import { pick } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { REM } from '../common/helpers/mediaDimensions';

import type { ApiSticker, ApiStickerSet } from '../../api/types';

import useAppLayout from '../../hooks/useAppLayout';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import useScrolledState from '../../hooks/useScrolledState';
import useAsyncRendering from '../right/hooks/useAsyncRendering';
import { useStickerPickerObservers } from '../common/hooks/useStickerPickerObservers';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import EmojiCategory from '../middle/composer/EmojiCategory';
import StickerSetCover from '../middle/composer/StickerSetCover';
import StickerSet from '../common/StickerSet';

import './FolderEmojiPicker.scss';
import { selectIsAlwaysHighPriorityEmoji, selectIsCurrentUserPremium } from '../../global/selectors';
import StickerButton from '../common/StickerButton';

type OwnProps = {
  className?: string;
  onEmojiSelect: (emoji: string, name: string, addToEnd: boolean) => void;
  onEmojiStickerSelect: (sticker: ApiSticker) => void;
  loadAndPlay: boolean;
  isTranslucent?: boolean;
};

type StateProps = Pick<GlobalState, 'recentEmojis'> & {
  customEmojiSetIds?: string[];
  stickerSetsById: Record<string, ApiStickerSet>;
  canAnimate?: boolean;
  isCurrentUserPremium?: boolean;
};;

type EmojiCategoryData = { id: string; name: string; emojis: string[] };

const ICONS_BY_CATEGORY: Record<string, IconName> = {
  recent: 'recent',
  people: 'smile',
};

const OPEN_ANIMATION_DELAY = 200;
const SMOOTH_SCROLL_DISTANCE = 100;
const FOCUS_MARGIN = 3.25 * REM;
const HEADER_BUTTON_WIDTH = 2.625 * REM; // Includes margins
const INTERSECTION_THROTTLE = 200;

const categoryIntersections: boolean[] = [];

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

const FolderEmojiPicker: FC<OwnProps & StateProps> = ({
  className,
  recentEmojis,
  customEmojiSetIds,
  stickerSetsById,
  isTranslucent,
  loadAndPlay,
  canAnimate,
  isCurrentUserPremium,
  onEmojiSelect,
  onEmojiStickerSelect
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const [emojis, setEmojis] = useState<AllEmojis>();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const { isMobile } = useAppLayout();
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();
  const {
    openPremiumModal
  } = getActions();

  const { observe: observeIntersection } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  }, (entries) => {
    entries.forEach((entry) => {
      const { id } = entry.target as HTMLDivElement;
      if (!id || !id.startsWith('emoji-category-')) {
        return;
      }

      const index = Number(id.replace('emoji-category-', ''));
      categoryIntersections[index] = entry.isIntersecting;
    });

    const minIntersectingIndex = categoryIntersections.reduce((lowestIndex, isIntersecting, index) => {
      return isIntersecting && index < lowestIndex ? index : lowestIndex;
    }, Infinity);

    if (minIntersectingIndex === Infinity) {
      return;
    }

    setActiveCategoryIndex(minIntersectingIndex);
  });

  const canRenderContents = useAsyncRendering([], MENU_TRANSITION_DURATION);
  const shouldRenderContent = emojis && canRenderContents;

  useHorizontalScroll(headerRef, !(isMobile && shouldRenderContent));

  // Scroll header when active set updates
  useEffect(() => {
    if (!categories) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeCategoryIndex * HEADER_BUTTON_WIDTH - header.offsetWidth / 2 + HEADER_BUTTON_WIDTH / 2;

    animateHorizontalScroll(header, newLeft);
  }, [categories, activeCategoryIndex]);

  const lang = useOldLang();

  const customEmojiSets = useMemo(() => (
    customEmojiSetIds && Object.values(pick(stickerSetsById, customEmojiSetIds))
  ), [customEmojiSetIds, stickerSetsById]);


  const allCategories = useMemo(() => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }
    const themeCategories = [...categories];
    if (recentEmojis?.length) {
      themeCategories.unshift({
        id: RECENT_SYMBOL_SET_ID,
        name: lang('RecentStickers'),
        emojis: recentEmojis,
      });
    }
    themeCategories.unshift({
      id: FOLDER_SYMBOL_SET_ID,
      name: "",
      emojis: FOLDER_ICON_EMOJI,
    });

    return themeCategories;
  }, [categories, lang, recentEmojis]);

  // Initialize data on first render.
  useEffect(() => {
    setTimeout(() => {
      const exec = () => {
        setCategories(emojiData.categories);

        setEmojis(emojiData.emojis as AllEmojis);
      };

      if (emojiData) {
        exec();
      } else {
        ensureEmojiData()
          .then(exec);
      }
    }, OPEN_ANIMATION_DELAY);
  }, []);

  const selectCategory = useLastCallback((index: number, isStickerSet: boolean) => {
    setActiveCategoryIndex(index);
    const selector = isStickerSet ? `#EmojiPicker-emoji-sticker-set-${index}` : `#emoji-category-${index}`;
    const categoryEl = containerRef.current!.closest<HTMLElement>('.FolderEmojiPicker-main')!
      .querySelector(selector)! as HTMLElement;
    animateScroll({
      container: containerRef.current!,
      element: categoryEl,
      position: 'start',
      margin: FOCUS_MARGIN,
      maxDistance: SMOOTH_SCROLL_DISTANCE,
    });
  });

  const handleEmojiSelect = useLastCallback((emoji: string, name: string, addToEnd: boolean) => {
    onEmojiSelect(emoji, name, addToEnd);
  });

  const handleStickerSelect = useLastCallback((sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => {
    if (isCurrentUserPremium) {
      onEmojiStickerSelect(sticker);
    } else {
      openPremiumModal({
        initialSection: 'animated_emoji',
      });
    }
  });

  function renderCategoryButton(category: EmojiCategoryData, index: number) {
    const icon = ICONS_BY_CATEGORY[category.id];

    return icon && (
      <Button
        className={`symbol-set-button ${index === activeCategoryIndex ? 'activated' : ''}`}
        round
        faded
        color="translucent"
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => selectCategory(index, false)}
        ariaLabel={category.name}
      >
        <Icon name={icon} />
      </Button>
    );
  }

  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, "emojipicker", false);

  function renderEmojiCategoryIcon(stickerSet: ApiStickerSet, index: number) {
    const firstSticker = stickerSet.stickers?.[0];

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
    const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet as ApiStickerSet);

    if (stickerSet.hasThumbnail || !firstSticker) {
      return (
        <Button
          className={`symbol-set-button ${index === activeCategoryIndex ? 'activated' : ''}`}
          round
          faded
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => selectCategory(index, true)}
          ariaLabel={stickerSet.title}
        >
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate}
              forcePlayback
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
            />
        </Button>
      );
    }

    return (
      <StickerButton
        key={stickerSet.id}
        sticker={firstSticker}
        size={STICKER_SIZE_PICKER_HEADER}
        title={stickerSet.title}
        className={`symbol-set-button ${index === activeCategoryIndex ? 'activated' : ''}`}
        noPlay={!canAnimate}
        observeIntersection={observeIntersectionForCovers}
        noContextMenu
        isCurrentUserPremium
        sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
        withTranslucentThumb={isTranslucent}
        onClick={selectStickerSet}
        clickArg={index}
        forcePlayback
      />
    );
  }

  const containerClassName = buildClassName('FolderEmojiPicker', className);

  if (!shouldRenderContent) {
    return (
      <div className={containerClassName}>
        <Loading />
      </div>
    );
  }

  const headerClassName = buildClassName(
    'FolderEmojiPicker-header',
    !shouldHideTopBorder && 'with-top-border',
  );

  return (
    <div className={containerClassName}>
      <div
        ref={headerRef}
        className={headerClassName}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {allCategories.map(renderCategoryButton)}
        {customEmojiSets?.map(renderEmojiCategoryIcon)}
      </div>
      <div
        ref={containerRef}
        onScroll={handleContentScroll}
        className={buildClassName('FolderEmojiPicker-main', IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
      >
        {allCategories.map((category, i) => (
          <EmojiCategory
            category={category}
            index={i}
            allEmojis={emojis}
            observeIntersection={observeIntersection}
            shouldRender={activeCategoryIndex >= i - 1 && activeCategoryIndex <= i + 1}
            onEmojiSelect={handleEmojiSelect}
          />
        ))}
        {customEmojiSets != undefined && (
          <>
          {customEmojiSets.map((stickerSet: ApiStickerSet, i: number) => (
            <StickerSet
              key={stickerSet.id}
              stickerSet={stickerSet}
              loadAndPlay={Boolean(canAnimate && loadAndPlay)}
              noContextMenus={true}
              index={i}
              idPrefix={"EmojiPicker-emoji-sticker-set"}
              observeIntersection={observeIntersectionForSet}
              observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
              observeIntersectionForShowingItems={observeIntersectionForShowingItems}
              isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
              favoriteStickers={undefined}
              isCurrentUserPremium={isCurrentUserPremium}
              isTranslucent={isTranslucent}
              onStickerSelect={handleStickerSelect}
              onStickerUnfave={undefined}
              onStickerFave={undefined}
              onStickerRemoveRecent={undefined}
              forcePlayback
              shouldShowSimpleHeader
            />
          ))}
          </>
        )}
      </div>
    </div>
  );
};

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      ...pick(global, ['recentEmojis']),
      customEmojiSetIds: global.customEmojis.added.setIds,
      stickerSetsById: global.stickers.setsById,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(FolderEmojiPicker));
