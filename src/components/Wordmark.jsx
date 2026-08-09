// Two cuts of the wordmark.
//   "grotesk" (default) is the existing marketing lockup, unchanged.
//   "lazybee" is the design-system lockup: Italiana, wide tracking, uppercase.
//     Used on portal surfaces. See design-preview/assets/lazybee.css (.wordmark).
const Wordmark = ({ size = 'md', className = '', variant = 'grotesk' }) => {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  };

  if (variant === 'lazybee') {
    const lbSizes = {
      sm: 'text-sm',
      md: 'text-lg',
      lg: 'text-2xl',
      xl: 'text-4xl',
    };
    return (
      <span
        className={`uppercase leading-none select-none text-foreground ${lbSizes[size] || lbSizes.md} ${className}`}
        style={{ fontFamily: "'Italiana', serif", letterSpacing: '0.30em', fontWeight: 400 }}
      >
        Lazybee
      </span>
    );
  }

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
