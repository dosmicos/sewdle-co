import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowUpDown,
  ExternalLink,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Eye,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SocialPost } from '@/hooks/useMetaSocialAnalytics';

interface PostPerformanceTableProps {
  posts: SocialPost[];
  isLoading?: boolean;
}

type SortKey = 'published_at' | 'likes' | 'comments' | 'saves' | 'shares' | 'reach' | 'engagement_rate' | 'performance_score';

const typeLabels: Record<string, string> = {
  image: 'Imagen',
  reel: 'Reel',
  carousel: 'Carousel',
  video: 'Video',
  story: 'Story',
  text: 'Texto',
};

const platformColors: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
};

const PostPerformanceTable: React.FC<PostPerformanceTableProps> = ({ posts, isLoading }) => {
  const [sortKey, setSortKey] = useState<SortKey>('performance_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = [...posts];

    if (typeFilter !== 'all') {
      result = result.filter((p) => p.post_type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.caption.toLowerCase().includes(q) ||
          p.hashtags.some((h) => h.includes(q))
      );
    }

    result.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

    return result;
  }, [posts, typeFilter, searchQuery, sortKey, sortDir]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="pb-2 font-medium text-right cursor-pointer hover:text-foreground select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
      </span>
    </th>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Performance de Posts</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar caption o hashtag..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  className="pl-9 h-9 w-56"
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="image">Imagen</SelectItem>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="carousel">Carousel</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No se encontraron posts con los filtros actuales.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium w-[280px]">Post</th>
                      <th className="pb-2 font-medium">Tipo</th>
                      <SortHeader label="Fecha" field="published_at" />
                      <SortHeader label="Likes" field="likes" />
                      <SortHeader label="Comments" field="comments" />
                      <SortHeader label="Saves" field="saves" />
                      <SortHeader label="Shares" field="shares" />
                      <SortHeader label="Reach" field="reach" />
                      <SortHeader label="Eng. Rate" field="engagement_rate" />
                      <SortHeader label="Score" field="performance_score" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((post) => (
                      <tr
                        key={post.id}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedPost(post)}
                      >
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            {post.thumbnail_url ? (
                              <img
                                src={post.thumbnail_url}
                                alt=""
                                className="h-10 w-10 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-gray-100 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs truncate max-w-[200px]">
                                {post.caption || '(sin caption)'}
                              </p>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 mt-0.5 ${platformColors[post.platform]}`}
                              >
                                {post.platform === 'instagram' ? 'IG' : 'FB'}
                              </Badge>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <Badge variant="secondary" className="text-xs">
                            {typeLabels[post.post_type] || post.post_type}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground">
                          {format(new Date(post.published_at), 'dd MMM', { locale: es })}
                        </td>
                        <td className="py-2.5 text-right">{post.likes.toLocaleString()}</td>
                        <td className="py-2.5 text-right">{post.comments.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-medium text-amber-600">
                          {post.saves.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right">{post.shares.toLocaleString()}</td>
                        <td className="py-2.5 text-right">{post.reach.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-medium">
                          {(post.engagement_rate * 100).toFixed(2)}%
                        </td>
                        <td className="py-2.5 text-right">
                          <Badge
                            variant="outline"
                            className={
                              post.performance_score > 50
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : post.performance_score > 20
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-gray-50 text-gray-600'
                            }
                          >
                            {post.performance_score.toFixed(1)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {filtered.length} posts ({page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)})
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Post Detail Modal */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-lg">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base flex items-center gap-2">
                  <Badge className={platformColors[selectedPost.platform]}>
                    {selectedPost.platform === 'instagram' ? 'Instagram' : 'Facebook'}
                  </Badge>
                  <Badge variant="secondary">
                    {typeLabels[selectedPost.post_type] || selectedPost.post_type}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {selectedPost.thumbnail_url && (
                  <img
                    src={selectedPost.thumbnail_url}
                    alt=""
                    className="w-full rounded-lg object-cover max-h-64"
                  />
                )}

                <p className="text-sm whitespace-pre-wrap">{selectedPost.caption}</p>

                {selectedPost.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedPost.hashtags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="font-medium">{selectedPost.likes.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <MessageCircle className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{selectedPost.comments.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Bookmark className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">{selectedPost.saves.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Share2 className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{selectedPost.shares.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Eye className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">{selectedPost.reach.toLocaleString()}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Eng: </span>
                    <span className="font-medium">
                      {(selectedPost.engagement_rate * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(selectedPost.published_at), "d 'de' MMMM, yyyy 'a las' HH:mm", {
                      locale: es,
                    })}
                  </span>
                  {selectedPost.permalink && (
                    <a
                      href={selectedPost.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Ver post <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostPerformanceTable;
