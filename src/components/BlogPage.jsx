import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { blogPosts } from '../data/sampleData';
import SEO from './SEO';

const BlogPage = () => {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      try {
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
    if (searchTerm) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }
    setFilteredPosts(filtered);
  }, [posts, searchTerm, selectedCategory]);

  const categories = ['all', ...new Set(posts.map(post => post.category))];

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-24 pb-32">
        <div className="max-w-screen-2xl mx-auto px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-[400px] bg-slate-200 rounded-[2.5rem] mb-20"></div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="md:col-span-4">
                  <div className="aspect-square bg-slate-200 rounded-3xl mb-6"></div>
                  <div className="h-6 bg-slate-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const featuredPost = filteredPosts[0];
  const sidebarPost = filteredPosts[1];
  const remainingPosts = filteredPosts.slice(2);

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-24 pb-32">
      <SEO
        title="Blog — Co-living Stories & Tips"
        description="Read about co-living in Singapore: tips, stories, neighborhood guides, and lifestyle content from the Hyve community."
        canonical="/blog"
      />
      {/* Hero */}
      <header className="max-w-screen-2xl mx-auto px-6 md:px-8 mb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[#eff4ff] min-h-[400px] md:min-h-[500px] flex items-center">
          <div className="absolute inset-0 z-0">
            <div className="w-full h-full bg-gradient-to-r from-[#f8f9ff] via-[#f8f9ff]/80 to-transparent"></div>
          </div>
          <div className="relative z-10 max-w-3xl px-8 md:px-20">
            <span className="inline-block py-1 px-4 rounded-full bg-[#71f8e4] text-[#00201c] font-['Inter'] font-semibold text-xs tracking-wider mb-6">
              JOURNAL
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-[#121c2a] leading-[0.9] mb-8">
              Stories from the <span className="text-[#006b5f] italic">Sanctuary</span>
            </h1>
            <p className="text-xl text-[#3c4947] font-['Manrope'] max-w-xl leading-relaxed">
              Insights into coliving, community building, and the vibrant events shaping our global network.
            </p>
          </div>
        </div>
      </header>

      {/* Categories & Search */}
      <section className="max-w-screen-2xl mx-auto px-6 md:px-8 mb-12">
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-[rgba(187,202,198,0.15)] pb-8">
          <div className="flex gap-3 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-xl font-['Inter'] text-sm font-semibold transition-all ${
                  selectedCategory === category
                    ? 'bg-[#006b5f] text-white'
                    : 'bg-[#d9e3f6] text-[#555f6f] hover:bg-[#dee9fc]'
                }`}
              >
                {category === 'all' ? 'All Stories' : category}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-white rounded-xl px-4 py-2 border border-[rgba(187,202,198,0.15)] w-full md:w-80">
            <span className="material-symbols-outlined text-[#6c7a77] mr-2">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-['Manrope'] w-full"
              placeholder="Search articles..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="max-w-screen-2xl mx-auto px-6 md:px-8">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">article</span>
            <h3 className="text-xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] mb-2">
              No articles found
            </h3>
            <p className="text-[#3c4947] mb-4">Try adjusting your search or filters.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
              className="bg-[#006b5f] text-white px-6 py-3 rounded-xl font-['Plus_Jakarta_Sans'] font-bold hover:opacity-90 transition-all"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            {/* Featured Post */}
            {featuredPost && (
              <article className="md:col-span-8 group cursor-pointer">
                <Link to={`/blog/${featuredPost.slug}`}>
                  <div className="relative overflow-hidden rounded-3xl bg-white transition-all mb-6">
                    <img
                      className="w-full aspect-[16/9] object-cover group-hover:scale-105 transition-transform duration-700"
                      src={featuredPost.featuredImage}
                      alt={featuredPost.title}
                      loading="lazy"
                    />
                    <div className="absolute top-6 left-6">
                      <span className="bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-['Inter'] font-bold text-[#006b5f] shadow-sm uppercase tracking-widest">
                        {featuredPost.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mb-4 text-[#6c7a77] text-xs font-['Inter'] font-semibold uppercase tracking-widest">
                    <span>{formatDate(featuredPost.publishedAt)}</span>
                    <span className="w-1 h-1 rounded-full bg-[#bbcac6]"></span>
                    <span>{featuredPost.readTime} MIN READ</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] group-hover:text-[#006b5f] transition-colors leading-tight mb-4">
                    {featuredPost.title}
                  </h2>
                  <p className="text-lg text-[#3c4947] font-['Manrope'] leading-relaxed max-w-2xl">
                    {featuredPost.excerpt}
                  </p>
                </Link>
              </article>
            )}

            {/* Sidebar Post */}
            {sidebarPost && (
              <article className="md:col-span-4 group cursor-pointer">
                <Link to={`/blog/${sidebarPost.slug}`}>
                  <div className="relative overflow-hidden rounded-3xl bg-white mb-6">
                    <img
                      className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-700"
                      src={sidebarPost.featuredImage}
                      alt={sidebarPost.title}
                      loading="lazy"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-['Inter'] font-bold text-[#006b5f] shadow-sm uppercase tracking-widest">
                        {sidebarPost.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-3 text-[#6c7a77] text-[10px] font-['Inter'] font-semibold uppercase tracking-widest">
                    <span>{formatDate(sidebarPost.publishedAt)}</span>
                    <span className="w-1 h-1 rounded-full bg-[#bbcac6]"></span>
                    <span>{sidebarPost.readTime} MIN READ</span>
                  </div>
                  <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] group-hover:text-[#006b5f] transition-colors leading-snug">
                    {sidebarPost.title}
                  </h3>
                </Link>
              </article>
            )}

            {/* Remaining posts */}
            {remainingPosts.map((post) => (
              <article key={post.id} className="md:col-span-4 group cursor-pointer">
                <Link to={`/blog/${post.slug}`}>
                  <div className="relative overflow-hidden rounded-3xl bg-white mb-6">
                    <img
                      className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-700"
                      src={post.featuredImage}
                      alt={post.title}
                      loading="lazy"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-['Inter'] font-bold text-[#006b5f] shadow-sm uppercase tracking-widest">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-3 text-[#6c7a77] text-[10px] font-['Inter'] font-semibold uppercase tracking-widest">
                    <span>{formatDate(post.publishedAt)}</span>
                    <span className="w-1 h-1 rounded-full bg-[#bbcac6]"></span>
                    <span>{post.readTime} MIN READ</span>
                  </div>
                  <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold text-[#121c2a] group-hover:text-[#006b5f] transition-colors leading-snug">
                    {post.title}
                  </h3>
                </Link>
              </article>
            ))}

            {/* Newsletter CTA */}
            <aside className="md:col-span-4 flex flex-col justify-center bg-[#006b5f] text-white rounded-[2.5rem] p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#71f8e4]/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <span
                className="material-symbols-outlined text-4xl mb-6"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                format_quote
              </span>
              <h4 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold leading-tight mb-8">
                &ldquo;Design is not just what it looks like; it&apos;s how it fosters connection.&rdquo;
              </h4>
              <div className="border-t border-white/20 pt-8 mt-4">
                <p className="text-sm font-['Inter'] font-bold tracking-widest uppercase mb-4">
                  JOIN OUR COMMUNITY
                </p>
                <button
                  onClick={() => window.open('https://t.me/hyve_sg', '_blank', 'noopener,noreferrer')}
                  className="w-full bg-white text-[#006b5f] rounded-xl px-4 py-3 font-['Plus_Jakarta_Sans'] font-bold hover:bg-slate-50 transition-colors"
                >
                  Join Telegram
                </button>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
};

export default BlogPage;
