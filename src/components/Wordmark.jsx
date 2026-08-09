const Wordmark = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  };
  return (
    <span
      className={`font-extrabold lowercase tracking-tight text-foreground leading-none select-none ${sizes[size] || sizes.md} ${className}`}
      style={{ letterSpacing: '-0.03em', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      lazybee<span className="text-accent">.</span>
    </span>
  );
};

export default Wordmark;
