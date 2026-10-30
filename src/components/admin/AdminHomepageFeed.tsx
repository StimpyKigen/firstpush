import React, { useState, useSyncExternalStore, useRef, useMemo } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Video,
  Eye,
  Trash2,
  Check,
  EyeOff,
  X,
  Play,
  Code2,
  UploadCloud,
  FileImage,
  ArrowUp,
  ArrowDown,
  Edit3,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
  addCarouselItem,
  updateCarouselItem,
  replaceCarouselItemPhoto,
  reorderCarouselItems,
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
import {
  validateWebpFile,
  uploadCarouselPhotoWebp,
  replaceCarouselPhotoWebp,
  formatFileSize,
  MAX_WEBP_FILE_SIZE_BYTES,
  type WebpValidationResult,
} from '../../lib/carouselStorageService';
import { showToast } from '../../lib/notificationStore';

export default function AdminHomepageFeed() {
  const feed = useSyncExternalStore(
    subscribeToHomepageFeed,
    getHomepageFeedSnapshot,
    getHomepageFeedSnapshot
  );

  // -------------------------------------------------------------
  // CAROUSEL CREATION STATE (Direct WebP Upload to Firebase Storage)
  // -------------------------------------------------------------
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [fileValidation, setFileValidation] = useState<WebpValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Metadata Fields
  const [photoHeading, setPhotoHeading] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoSource, setPhotoSource] = useState('');
  const [photoOrder, setPhotoOrder] = useState<number>(1);
  const [photoPublished, setPhotoPublished] = useState<boolean>(true);
  const [isVisualPreviewOpen, setIsVisualPreviewOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // EDIT CAPTION / METADATA MODAL STATE (Without Re-uploading)
  // -------------------------------------------------------------
  const [editingItem, setEditingItem] = useState<HomepageCarouselItem | null>(null);
  const [editHeading, setEditHeading] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editOrder, setEditOrder] = useState<number>(1);
  const [editPublished, setEditPublished] = useState<boolean>(true);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // -------------------------------------------------------------
  // REPLACE IMAGE MODAL STATE (Uploads New WebP & Deletes Old Storage Binary)
  // -------------------------------------------------------------
  const [replacingItem, setReplacingItem] = useState<HomepageCarouselItem | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacePreviewUrl, setReplacePreviewUrl] = useState<string | null>(null);
  const [replaceValidation, setReplaceValidation] = useState<WebpValidationResult | null>(null);
  const [replaceValidationError, setReplaceValidationError] = useState<string | null>(null);
  const [replaceProgress, setReplaceProgress] = useState<number>(0);
  const [isReplacing, setIsReplacing] = useState<boolean>(false);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // VIDEO & EMBED FORM STATE
  // -------------------------------------------------------------
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [customEmbedUrl, setCustomEmbedUrl] = useState('');
  const [customEmbedCaption, setCustomEmbedCaption] = useState('');
  const [isCustomPreviewOpen, setIsCustomPreviewOpen] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  // Sorted carousel items according to explicit order ascending
  const sortedCarouselItems = useMemo(() => {
    return [...feed.carouselItems].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 9999;
      const orderB = typeof b.order === 'number' ? b.order : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [feed.carouselItems]);

  // Set default order to next available position when list updates
  React.useEffect(() => {
    if (feed.carouselItems.length > 0) {
      const maxOrder = Math.max(...feed.carouselItems.map((c) => (typeof c.order === 'number' ? c.order : 0)));
      setPhotoOrder(maxOrder + 1);
    } else {
      setPhotoOrder(1);
    }
  }, [feed.carouselItems.length]);

  // Handle WebP File Selection & Deep Client Validation
  const handleProcessFile = async (file: File) => {
    setValidationError(null);
    const result = await validateWebpFile(file);

    if (!result.valid) {
      setValidationError(result.error || 'Invalid WebP file.');
      setSelectedFile(null);
      setLocalPreviewUrl(null);
      setFileValidation(null);
      showToast({
        title: 'Validation Failed',
        message: result.error || 'Please choose a valid WebP image under 5 MB.',
        type: 'error',
      });
      return;
    }

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setLocalPreviewUrl(objectUrl);
    setFileValidation(result);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleClearSelectedFile = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setSelectedFile(null);
    setLocalPreviewUrl(null);
    setFileValidation(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Publish New WebP Photo to Firebase Storage and Cloud Firestore
  const handlePublishPhoto = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      showToast({
        title: 'File Required',
        message: 'Please drag & drop or select a valid WebP photo.',
        type: 'error',
      });
      return;
    }

    if (!photoHeading.trim() && !photoCaption.trim()) {
      showToast({
        title: 'Headline or Caption Required',
        message: 'Please enter a story heading or narrative caption.',
        type: 'error',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(1);

    try {
      const photoId = `carousel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // 1. Upload to Firebase Storage under homepage-carousel/{photoId}/{uniqueFilename}.webp
      const uploadResult = await uploadCarouselPhotoWebp(
        selectedFile,
        photoId,
        (progress) => setUploadProgress(progress)
      );

      // 2. Store metadata, caption, storagePath, order, and dimensions in Cloud Firestore & Server DB
      await addCarouselItem({
        imageUrl: uploadResult.downloadUrl,
        storagePath: uploadResult.storagePath,
        heading: photoHeading.trim(),
        caption: photoCaption.trim(),
        source: photoSource.trim(),
        order: Number(photoOrder) || 1,
        published: photoPublished,
        dimensions: uploadResult.dimensions,
        fileSize: uploadResult.fileSize,
      });

      // 3. Reset form state
      handleClearSelectedFile();
      setPhotoHeading('');
      setPhotoCaption('');
      setPhotoSource('');
      setUploadProgress(0);
      setIsVisualPreviewOpen(false);

      showToast({
        title: 'WebP Story Published',
        message: 'Photo binary uploaded to Firebase Storage and metadata saved to Firestore.',
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Upload Failed',
        message: err?.message || 'Could not upload photo to Firebase Storage.',
        type: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // -------------------------------------------------------------
  // EDIT CAPTION MODAL HANDLERS
  // -------------------------------------------------------------
  const handleOpenEdit = (item: HomepageCarouselItem) => {
    setEditingItem(item);
    setEditHeading(item.heading || '');
    setEditCaption(item.caption || '');
    setEditSource(item.source || '');
    setEditOrder(typeof item.order === 'number' ? item.order : 1);
    setEditPublished(item.published);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSavingEdit(true);
    try {
      await updateCarouselItem(editingItem.id, {
        heading: editHeading.trim(),
        caption: editCaption.trim(),
        source: editSource.trim(),
        order: Number(editOrder) || 1,
        published: editPublished,
      });

      setEditingItem(null);
      showToast({
        title: 'Story Updated',
        message: 'Carousel caption, source, and display order saved without re-uploading.',
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Update Failed',
        message: err?.message || 'Failed to update carousel story in database.',
        type: 'error',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // -------------------------------------------------------------
  // REPLACE PHOTO MODAL HANDLERS (Safe Replacement Workflow)
  // -------------------------------------------------------------
  const handleOpenReplace = (item: HomepageCarouselItem) => {
    setReplacingItem(item);
    setReplaceFile(null);
    setReplacePreviewUrl(null);
    setReplaceValidation(null);
    setReplaceValidationError(null);
    setReplaceProgress(0);
  };

  const handleReplaceFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReplaceValidationError(null);
    const result = await validateWebpFile(file);
    if (!result.valid) {
      setReplaceValidationError(result.error || 'Invalid WebP file.');
      showToast({ title: 'Invalid File', message: result.error || 'Select a valid WebP image.', type: 'error' });
      return;
    }

    if (replacePreviewUrl) {
      URL.revokeObjectURL(replacePreviewUrl);
    }

    setReplaceFile(file);
    setReplacePreviewUrl(URL.createObjectURL(file));
    setReplaceValidation(result);
  };

  const handleConfirmReplace = async () => {
    if (!replacingItem || !replaceFile) {
      showToast({ title: 'File Missing', message: 'Please select a replacement WebP file.', type: 'error' });
      return;
    }

    setIsReplacing(true);
    setReplaceProgress(1);

    try {
      // 1. Upload new image to Firebase Storage and safely clean old storage binary
      const uploadResult = await replaceCarouselPhotoWebp(
        replacingItem.storagePath,
        replaceFile,
        replacingItem.id,
        (progress) => setReplaceProgress(progress)
      );

      // 2. Update Firestore record with new storagePath and imageUrl
      await replaceCarouselItemPhoto(replacingItem.id, {
        imageUrl: uploadResult.downloadUrl,
        storagePath: uploadResult.storagePath,
        dimensions: uploadResult.dimensions,
        fileSize: uploadResult.fileSize,
      });

      if (replacePreviewUrl) {
        URL.revokeObjectURL(replacePreviewUrl);
      }
      setReplacingItem(null);
      setReplaceFile(null);
      setReplacePreviewUrl(null);
      setReplaceValidation(null);
      setReplaceProgress(0);

      showToast({
        title: 'Photo Replaced',
        message: 'New WebP photo active on carousel and old Storage file safely purged.',
        type: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Replacement Failed',
        message: err?.message || 'Could not replace carousel photo.',
        type: 'error',
      });
    } finally {
      setIsReplacing(false);
    }
  };

  // -------------------------------------------------------------
  // REORDERING HANDLERS
  // -------------------------------------------------------------
  const handleMoveUp = async (currentIndex: number) => {
    if (currentIndex <= 0) return;
    const reordered = [...sortedCarouselItems];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[currentIndex - 1];
    reordered[currentIndex - 1] = temp;

    try {
      await reorderCarouselItems(reordered.map((item) => item.id));
      showToast({ title: 'Reordered', message: 'Carousel order updated.', type: 'info' });
    } catch (err: any) {
      showToast({ title: 'Reorder Failed', message: err?.message || 'Could not save new order.', type: 'error' });
    }
  };

  const handleMoveDown = async (currentIndex: number) => {
    if (currentIndex >= sortedCarouselItems.length - 1) return;
    const reordered = [...sortedCarouselItems];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[currentIndex + 1];
    reordered[currentIndex + 1] = temp;

    try {
      await reorderCarouselItems(reordered.map((item) => item.id));
      showToast({ title: 'Reordered', message: 'Carousel order updated.', type: 'info' });
    } catch (err: any) {
      showToast({ title: 'Reorder Failed', message: err?.message || 'Could not save new order.', type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // SAFE DELETION HANDLER
  // -------------------------------------------------------------
  const handleDeleteCarousel = async (item: HomepageCarouselItem) => {
    const title = item.heading || item.caption || 'this carousel photo';
    const confirmMsg = `Are you sure you want to permanently delete "${title}"?\n\nThis will remove the story from the homepage and delete its WebP image from Firebase Storage.`;
    if (!confirm(confirmMsg)) return;

    try {
      await deleteCarouselItem(item.id);
      showToast({
        title: 'Photo Deleted',
        message: 'Carousel slide and associated Firebase Storage binary removed.',
        type: 'info',
      });
    } catch (err: any) {
      showToast({
        title: 'Delete Failed',
        message: err?.message || 'Could not delete carousel photo.',
        type: 'error',
      });
    }
  };

  const handleToggleCarousel = async (id: string) => {
    try {
      await toggleCarouselItemPublish(id);
      showToast({ title: 'Visibility Updated', message: 'Carousel display status updated in database.', type: 'info' });
    } catch (err: any) {
      showToast({ title: 'Update Failed', message: err?.message || 'Could not update visibility.', type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // VIDEO & CUSTOM EMBED SUBMISSION HANDLERS
  // -------------------------------------------------------------
  const handlePublishVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) {
      showToast({ title: 'URL Required', message: 'Please enter a YouTube video URL.', type: 'error' });
      return;
    }

    setIsSavingVideo(true);
    try {
      await addVideoItem({
        youtubeUrl: videoUrl.trim(),
        title: videoTitle.trim() || 'Match Highlights & Tactical Analysis',
        published: true,
      });

      setVideoUrl('');
      setVideoTitle('');
      setIsVideoPreviewOpen(false);
      showToast({ title: 'Highlight Video Saved', message: 'Video saved to database and live on homepage.', type: 'success' });
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err?.message || 'Could not save video.', type: 'error' });
    } finally {
      setIsSavingVideo(false);
    }
  };

  const previewEmbedUrl = videoUrl ? normalizeYouTubeEmbedUrl(videoUrl) : null;

  const handlePublishCustomEmbed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmbedUrl.trim()) {
      showToast({ title: 'Embed Link Required', message: 'Please enter an embed URL or <iframe> snippet.', type: 'error' });
      return;
    }

    setIsSavingVideo(true);
    try {
      await addCustomEmbedItem({
        embedUrl: customEmbedUrl.trim(),
        title: customEmbedCaption.trim() || 'Featured Media Embed',
        published: true,
      });

      setCustomEmbedUrl('');
      setCustomEmbedCaption('');
      setIsCustomPreviewOpen(false);
      showToast({ title: 'Custom Embed Saved', message: 'Embed saved to database and live on homepage.', type: 'success' });
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err?.message || 'Could not save embed.', type: 'error' });
    } finally {
      setIsSavingVideo(false);
    }
  };

  const previewCustomEmbedUrl = customEmbedUrl ? normalizeCustomEmbedUrl(customEmbedUrl) : null;

  return (
    <div className="space-y-8 text-slate-900">
      {/* =========================================================================
          SECTION 1: CAROUSEL WEBP PHOTO MANAGEMENT (FIREBASE STORAGE DIRECT UPLOADS)
          ========================================================================= */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <ImageIcon size={20} className="text-[#006C54]" />
              Weekly Editorial WebP Carousel
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload WebP matchday photos directly to Firebase Storage with full caption, credit, and display order management.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#006C54] flex items-center gap-1.5">
              <ShieldCheck size={13} /> Firebase Storage Active
            </span>
            <span className="text-xs font-medium text-slate-600">
              {feed.carouselItems.filter((i) => i.published).length} Published · {feed.carouselItems.length} Total
            </span>
          </div>
        </div>

        {/* WebP Upload & Story Creation Form */}
        <form onSubmit={handlePublishPhoto} className="mt-6 space-y-5">
          {/* DRAG-AND-DROP FILE UPLOAD ZONE */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileImage size={14} className="text-[#006C54]" />
                Select or Drop WebP Image (Max 5 MB)
              </span>
              <span className="text-[11px] text-slate-400 font-normal lowercase">
                Enforced: .webp · image/webp · RIFF container
              </span>
            </label>

            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-[#006C54] bg-[#006C54]/5 scale-[1.01]'
                    : 'border-slate-300 hover:border-[#006C54] hover:bg-slate-50/70 bg-[#FFFFF0]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/webp,.webp"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-2.5">
                  <div className="w-12 h-12 rounded-full bg-[#006C54]/10 text-[#006C54] flex items-center justify-center shadow-xs">
                    <UploadCloud size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Drag &amp; drop your WebP photo here, or <span className="text-[#006C54] underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Recommended 3:4 editorial ratio (e.g. 1200 × 1600 px). Max 5 MB.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Selected File Information & Instant Preview */
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {localPreviewUrl && (
                    <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 shadow-md border border-slate-300">
                      <img src={localPreviewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="text-left space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 truncate max-w-[220px] sm:max-w-[320px]">
                        {fileValidation?.name || selectedFile.name}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Valid WebP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Size: <strong className="text-slate-700">{formatFileSize(fileValidation?.sizeBytes || selectedFile.size)}</strong>
                      {fileValidation?.width && fileValidation?.height ? (
                        <> · Dimensions: <strong className="text-slate-700">{fileValidation.width} × {fileValidation.height} px</strong></>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Destination: <code className="text-slate-600 font-mono">homepage-carousel/{'{photoId}'}/...webp</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelectedFile}
                    disabled={isUploading}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <X size={14} /> Remove
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/webp,.webp"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {validationError && (
              <div className="mt-2 text-xs font-medium text-rose-600 flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                <AlertCircle size={14} />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* CAPTION, HEADING & METADATA INPUTS */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* 1. Carousel Heading */}
            <div className="md:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                1. Carousel Headline (Gold Accent)
              </label>
              <input
                type="text"
                placeholder="e.g. Top Stories & Matchday Perspectives"
                value={photoHeading}
                onChange={(e) => setPhotoHeading(e.target.value)}
                maxLength={90}
                className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Prominent headline rendered next to the photo in bold stadium gold (#D4AF37).
              </span>
            </div>

            {/* Display Order Number */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>Display Order</span>
                <span className="text-[11px] text-slate-400 font-normal lowercase">1 = first</span>
              </label>
              <input
                type="number"
                min={1}
                max={999}
                value={photoOrder}
                onChange={(e) => setPhotoOrder(Number(e.target.value) || 1)}
                className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Explicit position in the homepage rotation.
              </span>
            </div>

            {/* 2. Carousel Caption Narrative */}
            <div className="md:col-span-12">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                2. Carousel Story Caption
              </label>
              <textarea
                rows={3}
                placeholder="Enter detailed editorial narrative to display below the headline..."
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                maxLength={300}
                className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                <span>Refined narrative rendered directly underneath the headline.</span>
                <span>{photoCaption.length} / 300</span>
              </div>
            </div>

            {/* 3. Photo & News Source Credit */}
            <div className="md:col-span-8">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                <span>3. Photo &amp; News Source Credit (Optional)</span>
                <span className="text-[11px] text-slate-400 font-normal lowercase">Credit/attributions</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Reuters / Action Images, Getty Images, AFP"
                value={photoSource}
                onChange={(e) => setPhotoSource(e.target.value)}
                maxLength={80}
                className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Faded italic credit displayed below the photo on the left above the heading.
              </span>
            </div>

            {/* Visibility Toggle */}
            <div className="md:col-span-4 flex flex-col justify-center">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Visibility
              </label>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={photoPublished}
                  onChange={(e) => setPhotoPublished(e.target.checked)}
                  className="w-4 h-4 rounded text-[#006C54] focus:ring-[#006C54] cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium">
                  {photoPublished ? 'Publish immediately to homepage' : 'Save as omitted draft'}
                </span>
              </label>
            </div>
          </div>

          {/* UPLOAD PROGRESS BAR */}
          {isUploading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5 text-[#006C54]">
                  <RefreshCw size={13} className="animate-spin" /> Uploading WebP to Firebase Storage...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-[#006C54] to-[#4ADE80] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="bg-[#006C54] hover:bg-[#005441] disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Uploading to Firebase Storage ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={14} />
                  <span>Upload WebP &amp; Publish Carousel Story</span>
                </>
              )}
            </button>

            {localPreviewUrl && (
              <button
                type="button"
                onClick={() => setIsVisualPreviewOpen(!isVisualPreviewOpen)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Eye size={14} className="text-[#006C54]" />
                <span>{isVisualPreviewOpen ? 'Hide Live Preview' : 'Preview Console Display'}</span>
              </button>
            )}
          </div>

          {/* EXACT HOMEPAGE MOCK VISUAL PREVIEW */}
          {isVisualPreviewOpen && localPreviewUrl && (
            <div className="mt-4 p-5 bg-[#02241b] border border-[#054d3c] rounded-3xl text-white shadow-xl animate-editorial-fade-in">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-[#4ADE80] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} /> Live Visual Confirmation Preview
                </span>
                <button
                  type="button"
                  onClick={() => setIsVisualPreviewOpen(false)}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Console Layout: 3:4 photo left, caption hugging right */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6 lg:gap-7 items-start">
                <div className="w-full sm:w-auto sm:shrink-0">
                  <div className="relative w-[180px] xs:w-[200px] sm:w-[240px] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl bg-[#06372a] border border-white/10">
                    <img src={localPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-start space-y-2 text-left pt-2 sm:pt-0">
                  {photoSource.trim() ? (
                    <p className="text-[10px] sm:text-xs text-slate-400/80 italic tracking-wide">
                      Source: <span className="text-slate-300 font-medium not-italic">{photoSource}</span>
                    </p>
                  ) : null}
                  <h3 className="text-base sm:text-2xl font-black text-[#D4AF37] leading-tight tracking-tight">
                    {photoHeading || 'Matchday perspectives headline'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-100 font-bold sm:font-normal leading-relaxed">
                    {photoCaption || 'Detailed narrative story caption will appear right here hugging the photo with controlled allowance.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* =========================================================================
            ACTIVE EDITORIAL CAROUSEL FEED CARDS (EDIT, REPLACE, REORDER, DELETE)
            ========================================================================= */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Layers size={14} className="text-[#006C54]" />
              Active Editorial Carousel Stories ({sortedCarouselItems.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              Arranged by display order. Use arrows to reorder slides.
            </span>
          </div>

          {sortedCarouselItems.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-xs">
              No carousel photos added yet. Upload your first WebP photo above to activate the weekly editorial carousel.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedCarouselItems.map((item, index) => {
                const isStorageWebp = Boolean(item.storagePath && item.storagePath.startsWith('homepage-carousel/'));

                return (
                  <div
                    key={item.id}
                    className={`relative border rounded-2xl overflow-hidden transition-all flex flex-col justify-between ${
                      item.published ? 'bg-[#FFFFF0] border-slate-200 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    {/* PHOTO THUMBNAIL (3:4 Ratio) */}
                    <div className="relative aspect-[3/4] bg-slate-950 overflow-hidden flex items-center justify-center">
                      <img
                        src={item.imageUrl}
                        alt={item.heading || 'Editorial photo'}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                      {/* Top Badges: Order & Storage Status */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white border border-white/20">
                          #{item.order ?? index + 1}
                        </span>

                        {isStorageWebp ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-400/40 flex items-center gap-1">
                            <ShieldCheck size={10} /> WebP Storage
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-400/40" title="External URL. Click Replace to upgrade to Firebase Storage.">
                            Legacy URL
                          </span>
                        )}
                      </div>

                      {/* Overlay Caption Info */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 text-white">
                        {item.source && (
                          <p className="text-[9px] text-slate-300/80 italic line-clamp-1 mb-0.5">
                            Source: {item.source}
                          </p>
                        )}
                        {item.heading && (
                          <p className="text-xs font-bold leading-tight line-clamp-2 text-[#D4AF37] mb-0.5">
                            {item.heading}
                          </p>
                        )}
                        {item.caption && (
                          <p className="text-[10px] text-slate-200 font-normal leading-snug line-clamp-2">
                            {item.caption}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* CARD CONTROLS & ACTIONS */}
                    <div className="p-3 bg-white border-t border-slate-100 flex flex-col space-y-2 text-xs">
                      {/* Top Action Row: Reorder & Status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-colors cursor-pointer"
                            title="Move Earlier in Carousel"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === sortedCarouselItems.length - 1}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-colors cursor-pointer"
                            title="Move Later in Carousel"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleCarousel(item.id)}
                          className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {item.published ? (
                            <>
                              <EyeOff size={11} /> Omit
                            </>
                          ) : (
                            <>
                              <Check size={11} className="text-[#006C54]" /> Publish
                            </>
                          )}
                        </button>
                      </div>

                      {/* Bottom Action Row: Edit Story, Replace Photo, Delete */}
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                            title="Edit headline, caption, or order without re-uploading"
                          >
                            <Edit3 size={12} className="text-[#006C54]" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenReplace(item)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                            title="Upload replacement WebP file"
                          >
                            <RefreshCw size={12} className="text-[#006C54]" />
                            <span>Replace Photo</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCarousel(item)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete photo & storage binary"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          MODAL 1: EDIT CAPTION & METADATA (NO IMAGE RE-UPLOAD)
          ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-editorial-fade-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2">
                <Edit3 size={18} className="text-[#006C54]" />
                Edit Carousel Story
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Headline (Gold Accent)
                </label>
                <input
                  type="text"
                  value={editHeading}
                  onChange={(e) => setEditHeading(e.target.value)}
                  maxLength={90}
                  className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Story Narrative Caption
                </label>
                <textarea
                  rows={3}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  maxLength={300}
                  className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Photo Source Credit
                  </label>
                  <input
                    type="text"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    maxLength={80}
                    className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#006C54]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editOrder}
                    onChange={(e) => setEditOrder(Number(e.target.value) || 1)}
                    className="w-full bg-[#FFFFF0] border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#006C54]"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPublished}
                    onChange={(e) => setEditPublished(e.target.checked)}
                    className="w-4 h-4 rounded text-[#006C54] focus:ring-[#006C54] cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium">Published on homepage</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#006C54] hover:bg-[#005441] text-white transition-all cursor-pointer shadow-xs"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: REPLACE WEBP PHOTO (SAFE STORAGE SWAP WORKFLOW)
          ========================================================================= */}
      {replacingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-editorial-fade-in space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2">
                <RefreshCw size={18} className="text-[#006C54]" />
                Replace Carousel Photo
              </h3>
              <button
                type="button"
                onClick={() => setReplacingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select a new WebP photo to replace the current image. The new file will be uploaded to Firebase Storage and the old binary safely deleted after save.
            </p>

            {/* Current vs New Image Comparison Preview */}
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Current Image</span>
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-xs">
                  <img src={replacingItem.imageUrl} alt="Current" className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="text-center space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">New WebP Image</span>
                {replacePreviewUrl ? (
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 border border-emerald-400 shadow-md">
                    <img src={replacePreviewUrl} alt="Replacement Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    onClick={() => replaceFileInputRef.current?.click()}
                    className="relative aspect-[3/4] rounded-xl border-2 border-dashed border-slate-300 hover:border-[#006C54] bg-slate-50 flex flex-col items-center justify-center p-3 cursor-pointer text-center"
                  >
                    <UploadCloud size={24} className="text-[#006C54] mb-1" />
                    <span className="text-xs font-semibold text-slate-700">Click to Select WebP</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Max 5 MB</span>
                  </div>
                )}
              </div>
            </div>

            <input
              ref={replaceFileInputRef}
              type="file"
              accept="image/webp,.webp"
              onChange={handleReplaceFileInputChange}
              className="hidden"
            />

            {replaceValidation && (
              <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl flex items-center justify-between">
                <span>{replaceValidation.name} ({formatFileSize(replaceValidation.sizeBytes || 0)})</span>
                {replaceValidation.width && replaceValidation.height ? (
                  <span className="font-semibold">{replaceValidation.width} × {replaceValidation.height} px</span>
                ) : null}
              </div>
            )}

            {replaceValidationError && (
              <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{replaceValidationError}</span>
              </div>
            )}

            {isReplacing && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span className="text-[#006C54]">Uploading replacement to Firebase Storage...</span>
                  <span>{replaceProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#006C54] transition-all duration-300"
                    style={{ width: `${replaceProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => replaceFileInputRef.current?.click()}
                disabled={isReplacing}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Choose Another File
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReplacingItem(null)}
                  disabled={isReplacing}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReplace}
                  disabled={isReplacing || !replaceFile}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#006C54] hover:bg-[#005441] disabled:opacity-50 text-white transition-all cursor-pointer shadow-xs"
                >
                  {isReplacing ? 'Uploading & Replacing...' : 'Confirm Replacement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: VIDEOS AND HIGHLIGHTS (PRESERVED)
          ========================================================================= */}
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
          <span className="text-xs font-medium text-slate-600 self-start sm:self-auto">
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
              disabled={isSavingVideo}
              className="bg-[#006C54] hover:bg-[#005441] disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {isSavingVideo ? 'Saving to Database...' : 'Publish Video Highlight'}
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
                disabled={isSavingVideo}
                className="bg-[#006C54] hover:bg-[#005441] disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                {isSavingVideo ? 'Saving to Database...' : 'Publish Custom Embed'}
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
                            onClick={() => deleteVideoItem(v.id)}
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
