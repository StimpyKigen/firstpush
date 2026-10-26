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
  Play,
  Code2
} from 'lucide-react';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
  addCarouselItem,
  toggleCarouselItemPublish,
  deleteCarouselItem,
  addVideoItem,
  addCustomEmbedItem,
  toggleVideoItemPublish,
  deleteVideoItem,
  normalizeYouTubeEmbedUrl,
  normalizeCustomEmbedUrl,
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
  const [photoHeading, setPhotoHeading] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video Form State
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);

  // Custom / Non-YouTube Embed Form State
  const [customEmbedUrl, setCustomEmbedUrl] = useState('');
  const [customEmbedCaption, setCustomEmbedCaption] = useState('');
  const [isCustomPreviewOpen, setIsCustomPreviewOpen] = useState(false);

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
      heading: photoHeading.trim() || undefined,
      caption: photoCaption.trim() || undefined,
      published: true,
    });

    setPhotoUrl('');
    setPhotoHeading('');
    setPhotoCaption('');
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

  // Submit Custom Non-YouTube Embed
  const handlePublishCustomEmbed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmbedUrl.trim()) {
      showToast({ title: 'Embed Link Required', message: 'Please enter an embed URL or <iframe> snippet.', type: 'error' });
      return;
    }

    try {
      addCustomEmbedItem({
        embedUrl: customEmbedUrl.trim(),
        title: customEmbedCaption.trim() || 'Featured Media Embed',
        published: true,
      });

      setCustomEmbedUrl('');
      setCustomEmbedCaption('');
      setIsCustomPreviewOpen(false);

      showToast({ title: 'Custom Embed Published', message: 'Embed added to homepage highlights.', type: 'success' });
    } catch (err: any) {
      showToast({ title: 'Invalid Embed Link', message: err.message || 'Could not parse embed URL.', type: 'error' });
    }
  };

  const previewCustomEmbedUrl = customEmbedUrl ? normalizeCustomEmbedUrl(customEmbedUrl) : null;

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
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
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

          {/* Two Explicit Caption Inputs: 1. Carousel heading, 2. Carousel caption */}
          <div className="space-y-4">
            {/* 1. Carousel Heading */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                1. Carousel Heading
              </label>
              <input
                type="text"
                placeholder="e.g. Match of the year is coming"
                value={photoHeading}
                onChange={(e) => setPhotoHeading(e.target.value)}
                maxLength={90}
                className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Prominent large white headline displayed on the left side of the slide.
              </span>
            </div>

            {/* 2. Carousel Caption */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                2. Carousel Caption
              </label>
              <textarea
                rows={3}
                placeholder="Enter the detailed story description or narrative text to display on the right side..."
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                maxLength={300}
                className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                <span>Displayed in smaller, elegant text on the right side that never cuts into the photo.</span>
                <span>{photoCaption.length} / 300</span>
              </div>
            </div>
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

          {/* Visual Preview Box (Exact Mock of Faded Green Layout with 3:4 Photo, Left Heading & Right Caption) */}
          {isPhotoPreviewOpen && photoUrl.trim() && (
            <div className="mt-4 p-5 bg-gradient-to-b from-[#02241b] via-[#032e23] to-[#011c15] border border-[#054d3c] rounded-3xl text-white shadow-xl">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-[#4ADE80] uppercase tracking-wider">
                  Live Visual Confirmation Preview
                </span>
                <button
                  type="button"
                  onClick={() => setIsPhotoPreviewOpen(false)}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Exact Mock of Homepage Carousel Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Left: Heading */}
                <div className="space-y-2">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider">
                    NEW · Editorial Preview
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
                    {photoHeading || 'Match of the year is coming'}
                  </h3>
                </div>

                {/* Center: 3:4 Photo with faded edges */}
                <div className="flex flex-col items-center">
                  <div className="relative w-full max-w-[220px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl bg-black">
                    <img
                      src={photoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    {/* Faded edges overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#02241b]/80 via-transparent to-[#02241b]/30 pointer-events-none" />
                  </div>
                  {/* Minimalist dots indicator */}
                  <div className="flex items-center gap-1.5 mt-3">
                    <span className="w-5 h-1.5 rounded-full bg-[#4ADE80]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  </div>
                </div>

                {/* Right: Caption */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest block">
                    Story Summary
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {photoCaption || 'Detailed narrative description will render here on the right side of the photo console without overlapping.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Existing Carousel Items Table / List */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-4">
            Active Editorial Feed ({feed.carouselItems.length}) · Cards
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
                    item.published ? 'bg-[#FFFFF0] border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="relative aspect-[3/4] bg-slate-950 overflow-hidden flex items-center justify-center">
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 text-white">
                      {item.heading && (
                        <p className="text-xs font-bold leading-tight line-clamp-2 mb-0.5">
                          {item.heading}
                        </p>
                      )}
                      {item.caption && (
                        <p className="text-[10px] text-slate-300 font-normal leading-snug line-clamp-2">
                          {item.caption}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 flex items-center justify-between gap-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] font-semibold">
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
                        className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
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
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
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
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
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

        {/* SECTION 2B: NON-YOUTUBE EMBED FORM */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="mb-4">
            <h4 className="font-semibold text-sm text-slate-900 tracking-tight flex items-center gap-2">
              <Code2 size={17} className="text-[#006C54]" />
              Other Embed URLs &amp; Custom Iframes
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Add other non-YouTube embeds (e.g. Vimeo, Dailymotion, Streamable, sports widgets, or raw &lt;iframe&gt; codes) with a custom caption.
            </p>
          </div>

          <form onSubmit={handlePublishCustomEmbed} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                Other Embed URL or Iframe Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Paste embed link or <iframe> code (e.g. https://player.vimeo.com/video/... or <iframe src='...'>)"
                  value={customEmbedUrl}
                  onChange={(e) => setCustomEmbedUrl(e.target.value)}
                  className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                Embed Caption / Headline
              </label>
              <input
                type="text"
                placeholder="e.g. Tactical Breakdown & Pitchside Analysis"
                value={customEmbedCaption}
                onChange={(e) => setCustomEmbedCaption(e.target.value)}
                className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
              />
            </div>

            {/* Action Buttons: Preview & Publish */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                className="bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Publish Custom Embed
              </button>

              {previewCustomEmbedUrl && (
                <button
                  type="button"
                  onClick={() => setIsCustomPreviewOpen(!isCustomPreviewOpen)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Play size={13} className="text-[#006C54]" />
                  <span>{isCustomPreviewOpen ? 'Hide Embed Preview' : 'Preview Embed Playback'}</span>
                </button>
              )}
            </div>

            {/* Live Custom Embed Preview Box */}
            {isCustomPreviewOpen && previewCustomEmbedUrl && (
              <div className="mt-4 p-4 bg-[#F5F5F7] border border-slate-200 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-700">Embed Confirmation Preview</span>
                  <button
                    type="button"
                    onClick={() => setIsCustomPreviewOpen(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="relative w-full max-w-[360px] mx-auto aspect-[16/9] rounded-xl overflow-hidden bg-black shadow-md">
                  <iframe
                    src={previewCustomEmbedUrl}
                    title="Preview Custom Embed"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center mt-2 break-all">
                  Rendered Frame Source: {previewCustomEmbedUrl}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Existing Videos & Highlights List */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-4">
            Published Highlights &amp; Embeds ({feed.videoItems.length})
          </h4>

          {feed.videoItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No highlights added yet. Enter a YouTube URL or other embed link above to add highlights to the homepage.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {feed.videoItems.map((v) => {
                const isCustom = v.type === 'custom' || (!v.embedUrl.includes('youtube.com') && !v.embedUrl.includes('youtu.be'));
                return (
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
                      <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded-md">
                        {isCustom ? 'Custom Embed' : 'YouTube'}
                      </div>
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
                              if (confirm('Delete this highlight from the feed?')) {
                                deleteVideoItem(v.id);
                                showToast({ title: 'Highlight Removed', message: 'Item deleted from highlights.', type: 'info' });
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete highlight"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
