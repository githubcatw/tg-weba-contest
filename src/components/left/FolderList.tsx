import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../lib/teact/teact';

import type { MenuItemContextAction } from '../ui/ListItem';

import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import buildClassName from '../../util/buildClassName';
import { LeftColumnContent } from '../../types';
import { IS_ELECTRON, IS_APP, IS_MAC_OS } from '../../util/windowEnvironment';
import {
  APP_NAME,
  DEBUG,
  IS_BETA,
} from '../../config';

import useAppLayout from '../../hooks/useAppLayout';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import FolderIcon from '../ui/FolderIcon';
import useFlag from '../../hooks/useFlag';
import { useFullscreenStatus } from '../../hooks/window/useFullscreen';
import DropdownMenu from '../ui/DropdownMenu';
import Button from '../ui/Button';
import LeftSideMenuItems from './main/LeftSideMenuItems';

import './FolderList.scss';
import { ApiMessageEntity } from '../../api/types';

export type FolderTab = {
  id?: number;
  title: TeactNode;
  lastChar: string;
  lastEntity?: ApiMessageEntity;
  badgeCount?: number;
  isBlocked?: boolean;
  isBadgeActive?: boolean;
  emoticon?: string;
  contextActions?: MenuItemContextAction[];
};

type OwnProps = {
  folders: readonly FolderTab[];
  activeFolder: number;
  className?: string;
  leftContent: LeftColumnContent;
  FolderClassName?: string;
  shouldSkipTransition?: boolean;
  contextRootElementSelector?: string;
  onSwitchFolder: (index: number) => void;
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  onReset: NoneToVoidFunction;
};

const FolderList: FC<OwnProps> = ({
    folders, activeFolder, onSwitchFolder, leftContent,
    contextRootElementSelector, className, FolderClassName,
    onReset, onSelectSettings, onSelectContacts, onSelectArchived,
    shouldSkipTransition
}) => {
    // eslint-disable-next-line no-null/no-null
    const containerRef = useRef<HTMLDivElement>(null);
    const previousActiveFolder = usePreviousDeprecated(activeFolder);
    const lang = useOldLang();
    const { isMobile, isDesktop } = useAppLayout();

    const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();

    const areContactsVisible = leftContent === LeftColumnContent.Contacts;
    const hasMenu = leftContent === LeftColumnContent.ChatList;
    
    const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
      return ({ onTrigger, isOpen }) => (
        <Button
          round
          ripple={hasMenu && !isMobile}
          size="smaller"
          color="translucent"
          className={isOpen ? 'active' : ''}
          // eslint-disable-next-line react/jsx-no-bind
          onClick={hasMenu ? onTrigger : () => onReset()}
          ariaLabel={hasMenu ? lang('AccDescrOpenMenu2') : 'Return to chat list'}
        >
          <div className={buildClassName(
            'animated-menu-icon',
            !hasMenu && 'state-back',
            shouldSkipTransition && 'no-animation',
          )}
          />
        </Button>
      );
    }, [hasMenu, isMobile, lang, onReset, shouldSkipTransition]);

    const isFullscreen = useFullscreenStatus();

    const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

    return (
    <div
        className={buildClassName('FolderList', className)}
        ref={containerRef}
        dir={lang.isRtl ? 'rtl' : undefined}
    >
      
      <DropdownMenu
          trigger={MainButton}
          footer={`${APP_NAME} ${versionString}`}
          className={buildClassName(
            'main-menu',
          )}
          forceOpen={isBotMenuOpen}
          positionX='left'
          transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
        >
          <LeftSideMenuItems
            onSelectArchived={onSelectArchived}
            onSelectContacts={onSelectContacts}
            onSelectSettings={onSelectSettings}
            onBotMenuOpened={markBotMenuOpen}
            onBotMenuClosed={unmarkBotMenuOpen}
          />
        </DropdownMenu>
        <div>
          {folders.map((Folder, i) => (
            <FolderIcon
              key={Folder.id}
              title={Folder.title}
              lastChar={Folder.lastChar}
              lastEntity={Folder.lastEntity}
              isAllFolder={i === 0}
              isActive={i === activeFolder}
              isBlocked={Folder.isBlocked}
              badgeCount={Folder.badgeCount}
              isBadgeActive={Folder.isBadgeActive}
              emoticon={Folder.emoticon}
              previousActiveTab={previousActiveFolder}
              clickArg={i}
              contextRootElementSelector={contextRootElementSelector}
              className={FolderClassName}
              onClick={onSwitchFolder}
              contextActions={Folder.contextActions}
            />
          ))}
        </div>
    </div>
    );
};
  
export default memo(FolderList);
  