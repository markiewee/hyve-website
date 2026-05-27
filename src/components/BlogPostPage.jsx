import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, User, Tag, ArrowLeft, Share2, Copy, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { blogPosts } from '../data/sampleData';
import SEO from './SEO';
import { blogPostingSchema, breadcrumbSchema } from '../lib/seo';

const BlogPostPage = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const shareMenuRef = useRef(null);
  const shareMenuRef2 = useRef(null);

  useEffect(() => {
    const loadPost = async () => {
      try {
        // Find the post by slug
        const foundPost = blogPosts.find(p => p.slug === slug);

        if (foundPost) {
          setPost(foundPost);

          // Find related posts (same category or tags)
          const related = blogPosts
            .filter(p => p.id !== foundPost.id)
            .filter(p =>
              p.category === foundPost.category ||
              p.tags.some(tag => foundPost.tags.includes(tag))
            )
            .slice(0, 3);

          setRelatedPosts(related);
        }
      } catch (error) {
        console.error('Error loading blog post:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [slug]);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target) &&
          shareMenuRef2.current && !shareMenuRef2.current.contains(event.target)) {
        setShowShareMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const shareUrl = window.location.href;
  const shareTitle = post ? `${post.title} - Lazybee Blog` : 'Lazybee Blog';
  const shareText = post ? post.excerpt : 'Check out this article from Lazybee';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Function to render markdown-like content
  const renderContent = (content) => {
    // Simple markdown parsing for headers and lists
    const lines = content.split('\n');
    const elements = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-2xl font-display font-bold text-foreground mt-8 mb-4">
            {line.substring(3)}
          </h2>
        );
        index++;
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-xl font-display font-semibold text-foreground mt-6 mb-3">
            {line.substring(4)}
          </h3>
        );
        index++;
      } else if (line.startsWith('- ')) {
        // Handle list items — consume all consecutive '- ' lines
        const nextLines = [];
        const startIndex = index;
        while (index < lines.length && lines[index].startsWith('- ')) {
          nextLines.push(lines[index].substring(2));
          index++;
        }
        elements.push(
          <ul key={startIndex} className="list-disc list-inside space-y-2 mb-4 text-foreground-variant">
            {nextLines.map((item, itemIndex) => (
              <li key={itemIndex} className="leading-relaxed">
                {item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split('<strong>').map((part, partIndex) => {
                  if (partIndex % 2 === 0) return part;
                  const [bold, rest] = part.split('</strong>');
                  return <><strong key={partIndex} className="text-foreground">{bold}</strong>{rest}</>;
                })}
              </li>
            ))}
          </ul>
        );
      } else if (line.match(/^\d+\. /)) {
        // Handle numbered lists — consume all consecutive numbered lines
        const nextLines = [];
        const startIndex = index;
        while (index < lines.length && lines[index].match(/^\d+\. /)) {
          nextLines.push(lines[index].replace(/^\d+\. /, ''));
          index++;
        }
        elements.push(
          <ol key={startIndex} className="list-decimal list-inside space-y-2 mb-4 text-foreground-variant">
            {nextLines.map((item, itemIndex) => (
              <li key={itemIndex} className="leading-relaxed">
                {item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split('<strong>').map((part, partIndex) => {
                  if (partIndex % 2 === 0) return part;
                  const [bold, rest] = part.split('</strong>');
                  return <><strong key={partIndex} className="text-foreground">{bold}</strong>{rest}</>;
                })}
              </li>
            ))}
          </ol>
        );
      } else if (line.trim() && !line.startsWith('#')) {
        elements.push(
          <p key={index} className="text-foreground-variant leading-relaxed mb-4">
            {line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split('<strong>').map((part, partIndex) => {
              if (partIndex % 2 === 0) return part;
              const [bold, rest] = part.split('</strong>');
              return <><strong key={partIndex} className="text-foreground">{bold}</strong>{rest}</>;
            })}
          </p>
        );
        index++;
      } else {
        index++;
      }
    }

    return elements;
  };

  const RelatedPostCard = ({ post }) => (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden hover:border-accent transition-colors group">
      <div className="relative aspect-[3/2] overflow-hidden">
        <img
          src={post.featuredImage}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2 left-2">
          <span className="bg-background/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-display font-bold text-accent uppercase tracking-display">
            {post.category}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 text-foreground-variant text-xs mb-3">
          <Clock className="w-3 h-3" />
          <span>{post.readTime} min read</span>
        </div>
        <h3 className="font-display font-bold text-foreground text-base leading-snug group-hover:text-accent transition-colors mb-2">
          <Link to={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        <p className="text-foreground-variant text-sm leading-relaxed line-clamp-2">
          {post.excerpt.substring(0, 100)}...
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <main className="bg-background text-foreground pt-24 md:pt-28 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 md:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-surface rounded mb-4"></div>
            <div className="h-64 bg-surface rounded mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-surface rounded w-3/4"></div>
              <div className="h-4 bg-surface rounded"></div>
              <div className="h-4 bg-surface rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="bg-background text-foreground pt-24 md:pt-28 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 md:px-8 py-12 text-center">
          <h1 className="text-4xl font-display font-bold text-foreground mb-4">
            Article Not Found
          </h1>
          <p className="text-xl text-foreground-variant mb-8">
            The article you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link to="/blog">
            <Button className="bg-accent text-background hover:opacity-90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground pt-24 md:pt-28 min-h-screen pb-16">
      {post && (
        <SEO
          title={post.title}
          description={post.excerpt || ''}
          canonical={`/blog/${post.slug}`}
          type="article"
          ogImage={post.featuredImage || undefined}
          schema={[
            blogPostingSchema(post),
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Blog', path: '/blog' },
              { name: post.title, path: `/blog/${post.slug}` },
            ]),
          ]}
        />
      )}

      <div className="max-w-4xl mx-auto px-6 md:px-8">
        {/* Navigation */}
        <div className="mb-8">
          <Link
            to="/blog"
            className="inline-flex items-center text-accent hover:opacity-80 font-display font-medium transition-opacity"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>
        </div>

        {/* Article Header */}
        <article className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Featured Image */}
          <div className="relative aspect-[2/1] overflow-hidden">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6">
              <span className="inline-block bg-accent/90 backdrop-blur-md text-background px-4 py-1.5 rounded-full text-xs font-display font-bold uppercase tracking-display mb-4">
                {post.category}
              </span>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3 leading-tight">
                {post.title}
              </h1>
              <p className="text-foreground-variant text-lg leading-relaxed">
                {post.excerpt}
              </p>
            </div>
          </div>

          {/* Article Meta */}
          <div className="p-6 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-foreground-variant" />
                  <div>
                    <div className="font-display font-semibold text-foreground">{post.author}</div>
                    <div className="text-sm text-foreground-variant">{post.authorRole}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-foreground-variant">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">{formatDate(post.publishedAt)}</span>
                </div>

                <div className="flex items-center space-x-2 text-foreground-variant">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{post.readTime} min read</span>
                </div>
              </div>

              <div className="relative" ref={shareMenuRef}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:border-accent hover:text-accent"
                  onClick={() => setShowShareMenu(!showShareMenu)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>

                {showShareMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-surface border border-border rounded-xl shadow-xl p-2 z-10 min-w-48">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-foreground hover:text-accent"
                        onClick={handleCopyLink}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {copySuccess ? 'Copied!' : 'Copy Link'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-foreground hover:text-accent"
                        onClick={handleShareTwitter}
                      >
                        <Twitter className="w-4 h-4 mr-2" />
                        Share on Twitter
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-foreground hover:text-accent"
                        onClick={handleShareFacebook}
                      >
                        <Facebook className="w-4 h-4 mr-2" />
                        Share on Facebook
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-foreground hover:text-accent"
                        onClick={handleShareLinkedIn}
                      >
                        <Linkedin className="w-4 h-4 mr-2" />
                        Share on LinkedIn
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-display border border-border text-foreground-variant"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Article Content */}
          <div className="p-6 md:p-8 max-w-2xl mx-auto">
            <div className="prose-dark">
              {renderContent(post.content)}
            </div>
          </div>

          {/* Article Footer */}
          <div className="p-6 bg-surface-container border-t border-border">
            <div className="flex items-center justify-between">
              <div className="relative" ref={shareMenuRef2}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:border-accent hover:text-accent"
                  onClick={() => setShowShareMenu(!showShareMenu)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share this article
                </Button>

                {showShareMenu && (
                  <div className="absolute left-0 bottom-full mb-2 bg-surface border border-border rounded-xl shadow-xl p-2 z-10 min-w-48">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-foreground hover:text-accent"
                        onClick={handleCopyLink}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {copySuccess ? 'Copied!' : 'Copy Link'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-foreground hover:text-accent"
                        onClick={handleShareTwitter}
                      >
                        <Twitter className="w-4 h-4 mr-2" />
                        Share on Twitter
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-foreground hover:text-accent"
                        onClick={handleShareFacebook}
                      >
                        <Facebook className="w-4 h-4 mr-2" />
                        Share on Facebook
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-foreground hover:text-accent"
                        onClick={handleShareLinkedIn}
                      >
                        <Linkedin className="w-4 h-4 mr-2" />
                        Share on LinkedIn
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-sm text-foreground-variant">
                Published on {formatDate(post.publishedAt)}
              </div>
            </div>
          </div>
        </article>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-3xl font-display font-bold text-foreground mb-8">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <RelatedPostCard key={relatedPost.id} post={relatedPost} />
              ))}
            </div>
          </section>
        )}

        {/* Telegram Community CTA */}
        <div className="mt-12 bg-surface-container border border-border rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-display font-bold text-foreground mb-4">
            Enjoyed this article?
          </h3>
          <p className="text-foreground-variant mb-6">
            Join our Telegram community for more insights, updates, and discussions about coliving in Singapore.
          </p>
          <Button
            className="bg-accent text-background hover:opacity-90"
            onClick={() => window.open('https://t.me/lazybee_sg', '_blank', 'noopener,noreferrer')}
          >
            Join our Telegram Community
          </Button>
        </div>
      </div>
    </main>
  );
};

export default BlogPostPage;
