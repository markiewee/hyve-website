import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, User, Tag, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { blogPosts } from '../data/sampleData';

const BlogPage = () => {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading from API or use sample data
    const loadPosts = async () => {
      try {
        // In the future, this could fetch from Sanity or an API
        setPosts(blogPosts);
        setFilteredPosts(blogPosts);
      } catch (error) {
        console.error('Error loading blog posts:', error);
        setPosts(blogPosts);
        setFilteredPosts(blogPosts);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  useEffect(() => {
    let filtered = posts;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }

    // Filter by tag
    if (selectedTag !== 'all') {
      filtered = filtered.filter(post => 
        post.tags.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
      );
    }

    setFilteredPosts(filtered);
  }, [posts, searchTerm, selectedCategory, selectedTag]);

  // Get unique categories and tags
  const categories = ['all', ...new Set(posts.map(post => post.category))];
  const allTags = posts.flatMap(post => post.tags);
  const tags = ['all', ...new Set(allTags)];

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const BlogPostCard = ({ post }) => (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow group">
      <div className="relative aspect-[3/2] overflow-hidden">
        <img
          src={post.featuredImage}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-4 left-4">
          <Badge className="bg-teal-600 text-white">
            {post.category}
          </Badge>
        </div>
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="bg-white/90 text-gray-900">
            {post.readTime} min read
          </Badge>
        </div>
      </div>
      
      <CardHeader>
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(post.publishedAt)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <User className="w-4 h-4" />
            <span>{post.author}</span>
          </div>
        </div>
        
        <CardTitle className="text-xl hover:text-teal-600 transition-colors">
          <Link to={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </CardTitle>
        
        <CardDescription className="text-gray-600">
          {post.excerpt}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.slice(0, 3).map((tag, index) => (
            <Badge 
              key={index} 
              variant="outline" 
              className="text-xs cursor-pointer hover:bg-teal-50"
              onClick={() => setSelectedTag(tag)}
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </Badge>
          ))}
          {post.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{post.tags.length - 3} more
            </Badge>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            by {post.author} • {post.authorRole}
          </div>
          <Link to={`/blog/${post.slug}`}>
            <Button variant="outline" size="sm" className="text-teal-600 border-teal-600 hover:bg-teal-50">
              Read More
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg overflow-hidden shadow">
                  <div className="h-64 bg-gray-200"></div>
                  <div className="p-6">
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Hyve Blog
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Insights, tips, and stories from Singapore's coliving community
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-white appearance-none"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tag Filter */}
              <div className="relative">
                <Tag className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-white appearance-none"
                >
                  {tags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag === 'all' ? 'All Tags' : tag}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedTag('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            {filteredPosts.length === posts.length 
              ? `Showing all ${posts.length} articles`
              : `Showing ${filteredPosts.length} of ${posts.length} articles`
            }
          </p>
        </div>

        {/* Blog Posts Grid */}
        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No articles found
              </h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search terms or filters.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedTag('all');
                }}
              >
                Clear All Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Telegram Community CTA */}
        <Card className="mt-12 bg-teal-50 border-teal-200">
          <CardContent className="text-center py-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Join Our Community
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Connect with fellow residents and get the latest updates about coliving, Singapore neighborhoods, and community events.
            </p>
            <Button 
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => window.open('https://t.me/hyve_sg', '_blank', 'noopener,noreferrer')}
            >
              Join our Telegram Community
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BlogPage;