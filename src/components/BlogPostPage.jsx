import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, User, Tag, ArrowLeft, Share2, Heart, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { blogPosts } from '../data/sampleData';

const BlogPostPage = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Function to render markdown-like content
  const renderContent = (content) => {
    // Simple markdown parsing for headers and lists
    const lines = content.split('\n');
    const elements = [];
    
    lines.forEach((line, index) => {
      if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-2xl font-bold text-gray-900 mt-8 mb-4">
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-xl font-semibold text-gray-900 mt-6 mb-3">
            {line.substring(4)}
          </h3>
        );
      } else if (line.startsWith('- ')) {
        // Handle list items
        const nextLines = [];
        let i = index;
        while (i < lines.length && lines[i].startsWith('- ')) {
          nextLines.push(lines[i].substring(2));
          i++;
        }
        if (nextLines.length > 0) {
          elements.push(
            <ul key={index} className="list-disc list-inside space-y-2 mb-4 text-gray-700">
              {nextLines.map((item, itemIndex) => (
                <li key={itemIndex} className="leading-relaxed">
                  {item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split('<strong>').map((part, partIndex) => {
                    if (partIndex % 2 === 0) return part;
                    const [bold, rest] = part.split('</strong>');
                    return <><strong key={partIndex}>{bold}</strong>{rest}</>;
                  })}
                </li>
              ))}
            </ul>
          );
        }
      } else if (line.match(/^\d+\. /)) {
        // Handle numbered lists
        const nextLines = [];
        let i = index;
        while (i < lines.length && lines[i].match(/^\d+\. /)) {
          nextLines.push(lines[i].replace(/^\d+\. /, ''));
          i++;
        }
        if (nextLines.length > 0) {
          elements.push(
            <ol key={index} className="list-decimal list-inside space-y-2 mb-4 text-gray-700">
              {nextLines.map((item, itemIndex) => (
                <li key={itemIndex} className="leading-relaxed">
                  {item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split('<strong>').map((part, partIndex) => {
                    if (partIndex % 2 === 0) return part;
                    const [bold, rest] = part.split('</strong>');
                    return <><strong key={partIndex}>{bold}</strong>{rest}</>;
                  })}
                </li>
              ))}
            </ol>
          );
        }
      } else if (line.trim() && !line.startsWith('#') && !line.startsWith('- ') && !line.match(/^\d+\. /)) {
        elements.push(
          <p key={index} className="text-gray-700 leading-relaxed mb-4">
            {line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split('<strong>').map((part, partIndex) => {
              if (partIndex % 2 === 0) return part;
              const [bold, rest] = part.split('</strong>');
              return <><strong key={partIndex}>{bold}</strong>{rest}</>;
            })}
          </p>
        );
      }
    });
    
    return elements;
  };

  const RelatedPostCard = ({ post }) => (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-[3/2] overflow-hidden">
        <img
          src={post.featuredImage}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2">
          <Badge className="bg-teal-600 text-white text-xs">
            {post.category}
          </Badge>
        </div>
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-lg leading-tight">
          <Link 
            to={`/blog/${post.slug}`}
            className="hover:text-teal-600 transition-colors"
          >
            {post.title}
          </Link>
        </CardTitle>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{post.readTime} min read</span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <CardDescription className="text-sm">
          {post.excerpt.substring(0, 100)}...
        </CardDescription>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Article Not Found
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            The article you're looking for doesn't exist.
          </p>
          <Link to="/blog">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation */}
        <div className="mb-8">
          <Link 
            to="/blog" 
            className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>
        </div>

        {/* Article Header */}
        <article className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Featured Image */}
          <div className="relative aspect-[2/1] overflow-hidden">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-6 left-6">
              <Badge className="bg-teal-600 text-white mb-4">
                {post.category}
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                {post.title}
              </h1>
              <p className="text-xl text-gray-200">
                {post.excerpt}
              </p>
            </div>
          </div>

          {/* Article Meta */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-semibold text-gray-900">{post.author}</div>
                    <div className="text-sm text-gray-500">{post.authorRole}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">{formatDate(post.publishedAt)}</span>
                </div>
                
                <div className="flex items-center space-x-2 text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{post.readTime} min read</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Heart className="w-4 h-4 mr-2" />
                  Like
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Article Content */}
          <div className="p-6 md:p-8">
            <div className="prose prose-lg max-w-none">
              {renderContent(post.content)}
            </div>
          </div>

          {/* Article Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="outline" size="sm">
                  <Heart className="w-4 h-4 mr-2" />
                  Like this article
                </Button>
                <Button variant="outline" size="sm">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Comment
                </Button>
              </div>
              
              <div className="text-sm text-gray-500">
                Published on {formatDate(post.publishedAt)}
              </div>
            </div>
          </div>
        </article>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <RelatedPostCard key={relatedPost.id} post={relatedPost} />
              ))}
            </div>
          </section>
        )}

        {/* Newsletter CTA */}
        <Card className="mt-12 bg-teal-50 border-teal-200">
          <CardContent className="text-center py-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Enjoyed this article?
            </h3>
            <p className="text-gray-600 mb-6">
              Subscribe to our newsletter for more insights about coliving and Singapore.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md"
              />
              <Button className="bg-teal-600 hover:bg-teal-700">
                Subscribe
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BlogPostPage;