import React from 'react';
import { LayoutItem } from './types';

interface LayoutAnimatorProps {
  layout: LayoutItem;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps dynamic video/screen tiles with hardware-accelerated absolute positions.
 * Animates coordinates and size changes smoothly using CSS GPU transitions (translate3d).
 */
const LayoutAnimator: React.FC<LayoutAnimatorProps> = ({
  layout,
  children,
  className = '',
}) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
    zIndex: layout.zIndex,
    // Smooth transitions for grid cell shifts and size changes
    transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
    willChange: 'transform, width, height',
    boxSizing: 'border-box',
    padding: '4px', // Slight spacing between tiles for Google Meet look
  };

  return (
    <div style={style} className={`layout-animator-tile ${className}`}>
      <div className="w-full h-full relative overflow-hidden rounded-2xl">
        {children}
      </div>
    </div>
  );
};

export default React.memo(LayoutAnimator);
