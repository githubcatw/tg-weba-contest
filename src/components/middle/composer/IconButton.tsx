import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import './IconButton.scss';
import { IconName } from '../../../types/icons';
import Icon from '../../common/icons/Icon';

type OwnProps = {
  icon: IconName;
  focus?: boolean;
  onClick: (icon: IconName) => void;
};

const IconButton: FC<OwnProps> = ({
  icon, focus, onClick,
}) => {
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // Preventing safari from losing focus on Composer MessageInput
    e.preventDefault();

    onClick(icon);
  });

  const className = buildClassName(
    'IconButton',
    focus && 'focus',
  );

  return (
    <div
      className={className}
      onMouseDown={handleClick}
      title={`${icon}`}
    >
      <Icon name={icon} />
    </div>
  );
};

export default memo(IconButton);
