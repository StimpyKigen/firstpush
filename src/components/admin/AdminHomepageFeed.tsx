import React, { useState, useSyncExternalStore, useRef } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Video,
  Eye,
  Trash2,
  Check,
  EyeOff,
  Upload,
  Link as LinkIcon,
  X,
  Play
} from 'lucide-react';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
  addCarouselItem,
  toggleCarouselItemPublish,
  deleteCarouselItem,
  addVideoItem,
  toggleVideoItemPublish,
  deleteVideoItem,
  normalizeYouTubeEmbedUrl,
  type HomepageCarouselItem,
  type HomepageVideoItem,
} from '../../lib/homepageFeedStore';
import { showToast } from '../../lib/notificationStore';

export default function AdminHomepageFeed() {
  const feed = useSyncExternalStore(
    subscribeToHomepageFeed,
    getHomepageFeedSnapshot,
    getHomepageFeedSnapshot
  );

  // Carousel Photos Form State
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video Form State
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);

  // Handle Photo File Upload
  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast({ title: 'Invalid File', message: 'Please select a valid image file (PNG, JPG, WebP).', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPhotoUrl(dataUrl);
        showToast({ title: 'Photo Loaded', message: 'Image loaded successfully.', type: 'info' });
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Carousel Photo
  const handlePublishPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl.trim()) {
      showToast({ title: 'Photo Required', message: 'Please upload an image or provide an image URL.', type: 'error' });
      return;
    }

    addCarouselItem({
      imageUrl: photoUrl.trim(),
      caption: photoCaption.trim() || undefined,
      published: true,
    });

    setPhotoUrl('');
    setPhotoCaption('');
    setShowCaptionInput(false);
    setIsPhotoPreviewOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    showToast({ title: 'Carousel Photo Published', message: 'New photo slide is now live on the homepage.', type: 'success' });
  };

  // Submit YouTube Video
  const handlePublishVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) {
      showToast({ title: 'URL Required', message: 'Please enter a YouTube video URL.', type: 'error' });
      return;
    }

    try {
      addVideoItem({
        youtubeUrl: videoUrl.trim(),
        title: videoTitle.trim() || 'Match Highlights & Tactical Analysis',
        published: true,
      });

      setVideoUrl('');
      setVideoTitle('');
      setIsVideoPreviewOpen(false);

      showToast({ title: 'Highlight Video Published', message: 'Video added to homepage Highlights.', type: 'success' });
    } catch (err: any) {
      showToast({ title: 'Invalid URL', message: err.message || 'Could not parse YouTube link.', type: 'error' });
    }
  };

  const previewEmbedUrl = videoUrl ? normalizeYouTubeEmbedUrl(videoUrl) : null;

  return (
    <div className="space-y-8 text-slate-900">
      {/* SECTION 1: CAROUSEL PHOTOS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <ImageIcon size={20} className="text-[#006C54]" />
              Carousel Photos
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Add weekly editorial photos displayed on the homepage news carousel with bottom foreground captions.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
            {feed.carouselItems.filter((i) => i.published).length} Published · {feed.carouselItems.length} Total
          </span>
        </div>

        {/* Carousel Creation Form */}
        <form onSubmit={handlePublishPhoto} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Photo Source
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 relative">
                <input
                  type="text"
                  placeholder="Paste image URL (e.g. https://... or /images/...)"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
                />
              </div>

              <div className="sm:col-span-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileUpload}
                  className="hidden"
                  id="admin-photo-upload"
                />
                <label
                  htmlFor="admin-photo-upload"
                  className="w-full h-full flex items-center justify-center gap-2 bg-[#FFFFF0] hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-xs px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  <Upload size={14} className="text-[#006C54]" />
                  <span>Upload Local File</span>
                </label>
              </div>
            </div>
          </div>

          {/* Caption with '+' button */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Photo Caption
              </label>
              {!showCaptionInput && (
                <button
                  type="button"
                  onClick={() => setShowCaptionInput(true)}
                  className="text-xs font-semibold text-[#006C54] hover:text-[#005441] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Add Short Caption
                </button>
              )}
            </div>

            {showCaptionInput ? (
              <div className="relative">
                <textarea
                  rows={2}
                  placeholder="Enter a brief, impactful caption to display on the bottom foreground of the photo..."
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  maxLength={160}
                  className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all resize-none"
                />
                <div className="flex justify-between items-center text-[10.5px] text-slate-400 mt-1">
                  <span>Captions appear over an Apple-style bottom gradient scrim for crystal-clear readability.</span>
                  <span>{photoCaption.length} / 160</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No caption currently attached. Click &quot;+ Add Short Caption&quot; above if you would like text overlay.
              </p>
            )}
          </div>

          {/* Action Buttons: Preview & Publish */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Publish to Homepage Carousel
            </button>

            {photoUrl.trim() && (
              <button
                type="button"
                onClick={() => setIsPhotoPreviewOpen(!isPhotoPreviewOpen)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Eye size={14} className="text-[#006C54]" />
                <span>{isPhotoPreviewOpen ? 'Hide Visual Preview' : 'Preview Live Display'}</span>
              </button>
            )}
          </div>

          {/* Visual Preview Box */}
          {isPhotoPreviewOpen && photoUrl.trim() && (
            <div className="mt-4 p-4 bg-[#F5F5F7] border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700">Live Visual Confirmation Preview</span>
                <button
                  type="button"
                  onClick={() => setIsPhotoPreviewOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Exact Mock of Homepage Carousel Card (9:16 Aspect Ratio) */}
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] mx-auto aspect-[9/16] max-h-[70vh] rounded-3xl overflow-hidden bg-slate-950 shadow-md">
                <img
                  src={photoUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                {/* Foreground Scrim Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />

                {photoCaption ? (
                  <div className="absolute bottom-5 left-4 right-4 text-white z-10">
                    <span className="inline-block text-[#006C54] bg-white text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1.5 shadow-2xs">
                      Weekly Spotlight
                    </span>
                    <p className="font-semibold text-xs sm:text-sm leading-snug drop-shadow-sm line-clamp-4">
                      {photoCaption}
                    </p>
                  </div>
                ) : (
                  <div className="absolute bottom-4 left-4 text-xs text-white/60">
                    (No caption attached · image only)
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Existing Carousel Items Table / List */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4">
            Active Carousel Feed ({feed.carouselItems.length}) · 9:16 Cards
          </h4>

          {feed.carouselItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No carousel photos added yet. Upload a photo above to start your weekly editorial news slate.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {feed.carouselItems.map((item) => (
                <div
                  key={item.id}
                  className={`relative border rounded-2xl overflow-hidden transition-all flex flex-col justify-between ${
                    item.published ? 'bg-[#FFFFF0] border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="relative aspect-[9/16] bg-slate-900 overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                    {item.caption && (
                      <p className="absolute bottom-2.5 left-2.5 right-2.5 text-white text-[11px] font-medium leading-snug line-clamp-3">
                        {item.caption}
                      </p>
                    )}
                  </div>

                  <div className="p-3 flex items-center justify-between gap-1 border-t border-slate-100 text-xs">
                    <span className="text-[10px] font-semibold">
                      {item.published ? (
                        <span className="text-[#006C54] font-bold">Published</span>
                      ) : (
                        <span className="text-slate-400">Omitted</span>
                      )}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleCarouselItemPublish(item.id)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                        title={item.published ? 'Omit from homepage' : 'Publish to homepage'}
                      >
                        {item.published ? (
                          <>
                            <EyeOff size={11} /> Omit
                          </>
                        ) : (
                          <>
                            <Check size={11} /> Publish
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this carousel photo?')) {
                            deleteCarouselItem(item.id);
                            showToast({ title: 'Photo Removed', message: 'Carousel slide deleted.', type: 'info' });
                          }
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete photo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2: VIDEOS AND HIGHLIGHTS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <Video size={20} className="text-[#006C54]" />
              Videos and Highlights
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Add YouTube match highlights, weekly previews, or tactical breakdowns that appear beneath the carousel separated by a horizontal line.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
            {feed.videoItems.filter((v) => v.published).length} Published · {feed.videoItems.length} Total
          </span>
        </div>

        {/* Video Creation Form */}
        <form onSubmit={handlePublishVideo} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              YouTube Embed or Watch URL
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Paste YouTube link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Video Title / Headline
            </label>
            <input
              type="text"
              placeholder="e.g. Premier League Matchweek Highlights & Tactical Breakdown"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
            />
          </div>

          {/* Action Buttons: Preview & Publish */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              className="bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Publish Video Highlight
            </button>

            {previewEmbedUrl && (
              <button
                type="button"
                onClick={() => setIsVideoPreviewOpen(!isVideoPreviewOpen)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Play size={13} className="text-[#006C54]" />
                <span>{isVideoPreviewOpen ? 'Hide Video Preview' : 'Preview Video Playback'}</span>
              </button>
            )}
          </div>

          {/* Live Video Preview Box */}
          {isVideoPreviewOpen && previewEmbedUrl && (
            <div className="mt-4 p-4 bg-[#F5F5F7] border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700">Video Player Confirmation Preview</span>
                <button
                  type="button"
                  onClick={() => setIsVideoPreviewOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="relative w-full max-w-[360px] mx-auto aspect-[16/9] rounded-xl overflow-hidden bg-black shadow-md">
                <iframe
                  src={previewEmbedUrl}
                  title="Preview Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Standard Mobile &amp; Desktop Frame: 360 × 202.5 px (16:9)
              </p>
            </div>
          )}
        </form>

        {/* Existing Videos List */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4">
            Published Videos ({feed.videoItems.length})
          </h4>

          {feed.videoItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No videos added yet. Enter a YouTube URL above to add videos to the homepage highlights.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {feed.videoItems.map((v) => (
                <div
                  key={v.id}
                  className={`border rounded-2xl overflow-hidden transition-all flex flex-col justify-between max-w-[360px] mx-auto w-full ${
                    v.published ? 'bg-[#FFFFF0] border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="relative aspect-[16/9] bg-black overflow-hidden">
                    <iframe
                      src={v.embedUrl}
                      title={v.title}
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>

                  <div className="p-3.5 space-y-2">
                    <h5 className="font-semibold text-xs text-slate-900 truncate" title={v.title}>
                      {v.title}
                    </h5>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-[11px] font-semibold">
                        {v.published ? (
                          <span className="text-[#006C54] font-bold">Published</span>
                        ) : (
                          <span className="text-slate-400">Omitted</span>
                        )}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleVideoItemPublish(v.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {v.published ? (
                            <>
                              <EyeOff size={12} /> Omit
                            </>
                          ) : (
                            <>
                              <Check size={12} /> Publish
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Delete this video from highlights?')) {
                              deleteVideoItem(v.id);
                              showToast({ title: 'Video Removed', message: 'Video highlight deleted.', type: 'info' });
                            }
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete video"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
