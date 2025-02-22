import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { useEffect, useLayoutEffect, useRef } from '../../lib/teact/teact';

import type { MenuItemContextAction } from './ListItem';

import { requestForcedReflow, requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import { MouseButton } from '../../util/windowEnvironment';
import renderText from '../common/helpers/renderText';
import EMOJI_REGEX from '../../lib/twemojiRegex';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../hooks/useFastClick';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import type { IconName } from '../../types/icons';
import Menu from './Menu';
import MenuItem from './MenuItem';
import MenuSeparator from './MenuSeparator';
import {nativeToUnifiedExtendedWithCache, LOADED_EMOJIS, handleEmojiLoad} from '../../util/emoji/emoji';

import {
  BASE_URL, IS_PACKAGED_ELECTRON, FOLDER_ICON_EMOTICONS
} from '../../config';

import './FolderIcon.scss';
import { ApiMessageEntity } from '../../api/types';
import { processEntity } from '../common/helpers/renderTextWithEntities';
import FolderEmoticon from './FolderEmoticon';

type OwnProps = {
  className?: string;
  title: TeactNode;
  lastChar: string;
  lastEntity?: ApiMessageEntity;
  isAllFolder?: boolean
  isActive?: boolean;
  isBlocked?: boolean;
  badgeCount?: number;
  isBadgeActive?: boolean;
  previousActiveTab?: number;
  emoticon?: string;
  onClick?: (arg: number) => void;
  clickArg?: number;
  contextActions?: MenuItemContextAction[];
  contextRootElementSelector?: string;
};

const classNames = {
  active: 'FolderIcon--active',
  badgeActive: 'FolderIcon__badge--active',
};

const FolderIcon: FC<OwnProps> = ({
  className,
  title,
  isActive,
  isBlocked,
  isAllFolder,
  badgeCount,
  isBadgeActive,
  previousActiveTab,
  emoticon,
  lastEntity,
  lastChar,
  onClick,
  clickArg,
  contextActions,
  contextRootElementSelector,
}) => {
  // eslint-disable-next-line no-null/no-null
  const tabRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Set initial active state
    if (isActive && previousActiveTab === undefined && tabRef.current) {
      tabRef.current!.classList.add(classNames.active);
    }
  }, [isActive, previousActiveTab]);

  useEffect(() => {
    if (!isActive || previousActiveTab === undefined) {
      return;
    }

    const tabEl = tabRef.current!;
    const prevTabEl = tabEl.parentElement!.children[previousActiveTab];
    if (!prevTabEl) {
      // The number of tabs in the parent component has decreased. It is necessary to add the active tab class name.
      if (isActive && !tabEl.classList.contains(classNames.active)) {
        requestMutation(() => {
          tabEl.classList.add(classNames.active);
        });
      }
      return;
    }

    requestMutation(() => {
      requestForcedReflow(() => {
        return () => {
          prevTabEl.classList.remove(classNames.active);
          tabEl.classList.add(classNames.active);
        };
      });
    });
  }, [isActive, previousActiveTab]);

  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(tabRef, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick?.(clickArg!);
  });

  const getIconNameForEmoticon = (emoticon: string) => {
    if (FOLDER_ICON_EMOTICONS[emoticon] != undefined) return FOLDER_ICON_EMOTICONS[emoticon]
    console.warn("unsupported emoticon: " + emoticon)
    return "folder-default" as IconName
  }

  const getTriggerElement = useLastCallback(() => tabRef.current);
  const getRootElement = useLastCallback(
    () => (contextRootElementSelector ? tabRef.current!.closest(contextRootElementSelector) : document.body),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.FolderIcon-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  return (
    <div
      className={buildClassName('FolderIcon', onClick && 'FolderIcon--interactive', className)}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      ref={tabRef}
    >
      <div className="FolderIcon_emoticon">
        <FolderEmoticon
          isAllFolder={isAllFolder}
          entity={lastEntity}
          character={lastChar}
          emoticon={emoticon}
        />
        {Boolean(badgeCount) && (
          <span className={buildClassName('badge', isBadgeActive && classNames.badgeActive)}>{badgeCount}</span>
        )}
      </div> 
      <span className="FolderIcon_inner">
        {typeof title === 'string' ? renderText(title) : title}
        {isBlocked && <Icon name="lock-badge" className="blocked" />}
      </span>

      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="FolderIcon-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default FolderIcon;
