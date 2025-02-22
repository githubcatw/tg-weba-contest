import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import Icon from '../common/icons/Icon';
import { ApiMessageEntity } from '../../api/types';

import { processEntity } from '../common/helpers/renderTextWithEntities';
import { handleEmojiLoad, LOADED_EMOJIS, nativeToUnifiedExtendedWithCache } from '../../util/emoji/emoji';

import {
  BASE_URL, IS_PACKAGED_ELECTRON, FOLDER_ICON_EMOTICONS
} from '../../config';
import EMOJI_REGEX from '../../lib/twemojiRegex';
import { IconName } from '../../types/icons';

type OwnProps = {
  isAllFolder?: boolean;
  entity?: ApiMessageEntity;
  character: string;
  emoticon?: string;
  emojiSize?: number;
  applyEmojiSize?: boolean;
};
const EMOJI_FOLDER_SIZE = 36;

const FolderEmoticon: FC<OwnProps> = ({
  isAllFolder,
  entity,
  emoticon,
  emojiSize,
  applyEmojiSize,
  character
}) => {

  const size = emojiSize ? emojiSize : EMOJI_FOLDER_SIZE;

  const baseSrcUrl = IS_PACKAGED_ELECTRON ? BASE_URL : '.';

  const getIconNameForEmoticon = (emoticon: string) => {
    if (FOLDER_ICON_EMOTICONS[emoticon] != undefined) return FOLDER_ICON_EMOTICONS[emoticon]
    console.warn("unsupported emoticon: " + emoticon)
    return "folder-default" as IconName
  }

  // always render the All folder's icon as folder-chats (2 bubbles)
  if (isAllFolder) {
    return <Icon name="folder-chats" className="font-emoticon" style={applyEmojiSize ? `font-size: ${size}px;` : undefined} />
  }

  if (entity != undefined) {
    if (entity.type == "MessageEntityCustomEmoji") {
      // render the entity as an emoji
      return (
        <div 
          className="non-font-emoticon" 
          style={applyEmojiSize ? `width: ${size}px; height: ${size}px` : undefined}
        >
          {processEntity({
            entity: entity,
            entityContent: character,
            nestedEntityContent: [],
            emojiSize: size
          })}
        </div>
      )
    }
  } else if (emoticon != undefined) {
    if (FOLDER_ICON_EMOTICONS[emoticon] == undefined) {
      const code = nativeToUnifiedExtendedWithCache(emoticon);
      const src = `${baseSrcUrl}/img-apple-64/${code}.png`;
      const isLoaded = LOADED_EMOJIS.has(src);

      return (
        <img
          src={src}
          className={`emoji non-font-emoticon${!isLoaded ? ' opacity-transition slow shown' : ''}`}
          alt={emoticon}
          data-path={src}
          draggable={false}
          style={applyEmojiSize ? `width: ${size}px; height: ${size}px` : undefined}
          onLoad={!isLoaded ? handleEmojiLoad : undefined}
        />
      )
    } else {
      return (
        <Icon name={getIconNameForEmoticon(emoticon)} className="font-emoticon" />
      )
    } 
  } else {
    // if the last character is an emoji, render it as an emoji
    if (character.match(EMOJI_REGEX)) {
      const code = nativeToUnifiedExtendedWithCache(character);
      const src = `${baseSrcUrl}/img-apple-64/${code}.png`;
      const isLoaded = LOADED_EMOJIS.has(src);

      return (
        <img
          src={src}
          className={`emoji non-font-emoticon${!isLoaded ? ' opacity-transition slow shown' : ''}`}
          alt={character}
          data-path={src}
          draggable={false}
          style={applyEmojiSize ? `width: ${size}px; height: ${size}px` : undefined}
          onLoad={!isLoaded ? handleEmojiLoad : undefined}
        />
      )
    }
    // otherwise render the default folder icon
    return (
      <Icon name="folder-default" className="font-emoticon" style={applyEmojiSize ? `font-size: ${size}px;` : undefined} />
    )
  }
};

export default FolderEmoticon;