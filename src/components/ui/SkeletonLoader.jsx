import { motion } from 'framer-motion';

const shimmer = {
  animate: { opacity: [0.4, 1, 0.4] },
  transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
};

export function SkeletonBox({ className = '' }) {
  return (
    <motion.div
      {...shimmer}
      className={`bg-surface rounded-xl ${className}`}
    />
  );
}

export function SkeletonText({ width = 'w-full', className = '' }) {
  return (
    <motion.div
      {...shimmer}
      className={`h-4 bg-surface rounded-lg ${width} ${className}`}
    />
  );
}

export function SkeletonAvatar({ size = 'h-10 w-10' }) {
  return (
    <motion.div
      {...shimmer}
      className={`${size} bg-surface rounded-full shrink-0`}
    />
  );
}

export function PostSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="space-y-2 flex-1">
          <SkeletonText width="w-32" />
          <SkeletonText width="w-20" />
        </div>
      </div>
      <SkeletonText />
      <SkeletonText width="w-3/4" />
      <SkeletonText width="w-1/2" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-6 space-y-4">
      <SkeletonBox className="h-32 w-full" />
      <SkeletonText width="w-48" />
      <SkeletonText />
      <SkeletonText width="w-2/3" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-4">
        <SkeletonAvatar size="h-16 w-16" />
        <div className="space-y-2">
          <SkeletonText width="w-36" />
          <SkeletonText width="w-24" />
        </div>
      </div>
      <SkeletonText />
      <SkeletonText width="w-3/4" />
    </div>
  );
}

export default SkeletonBox;
