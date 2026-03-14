'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import PhotoCompare from './PhotoCompare'
import { Camera, X, Upload } from 'lucide-react'

interface Photo {
  id: string
  photo_url: string
  category: 'front' | 'side' | 'back'
  taken_at: string
  notes?: string | null
}

type UploadStage = 'idle' | 'validating' | 'uploading' | 'saving'

interface ProgressPhotosProps {
  photos: Photo[]
  onUpload: (file: File, category: 'front' | 'side' | 'back', notes: string) => Promise<void>
  onDelete: (id: string) => void
  uploading: boolean
}

const categoryLabels: Record<'front' | 'side' | 'back', string> = {
  front: 'Voorkant',
  side: 'Zijkant',
  back: 'Achterkant',
}

const categoryColors: Record<'front' | 'side' | 'back', string> = {
  front: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  side: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  back: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

type FilterType = 'all' | 'front' | 'side' | 'back'

export default function ProgressPhotos({
  photos,
  onUpload,
  onDelete,
  uploading,
}: ProgressPhotosProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState<'front' | 'side' | 'back'>('front')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle')

  const filteredPhotos = selectedFilter === 'all'
    ? photos
    : photos.filter(p => p.category === selectedFilter)

  const groupedPhotos = filteredPhotos.reduce((acc, photo) => {
    const date = format(parseISO(photo.taken_at), 'PPP', { locale: nl })
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(photo)
    return acc
  }, {} as Record<string, Photo[]>)

  const sortedDates = Object.keys(groupedPhotos).sort((a, b) => {
    return parseISO(groupedPhotos[b][0].taken_at).getTime() -
           parseISO(groupedPhotos[a][0].taken_at).getTime()
  })

  const handleUploadSubmit = async () => {
    setUploadError('')

    if (!uploadFile) {
      setUploadError('Selecteer een foto alstublieft')
      return
    }

    try {
      setUploadStage('validating')
      // Brief pause so user sees validation step
      await new Promise(r => setTimeout(r, 200))
      setUploadStage('uploading')
      await onUpload(uploadFile, uploadCategory, uploadNotes)
      setUploadStage('saving')
      await new Promise(r => setTimeout(r, 300))
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadNotes('')
      setUploadCategory('front')
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload mislukt')
    } finally {
      setUploadStage('idle')
    }
  }

  const uploadStageLabel: Record<UploadStage, string> = {
    idle: '',
    validating: 'Valideren...',
    uploading: 'Foto uploaden...',
    saving: 'Opslaan...',
  }

  const uploadStageProgress: Record<UploadStage, number> = {
    idle: 0,
    validating: 20,
    uploading: 60,
    saving: 90,
  }

  // Fullscreen photo state
  const [fullscreenPhoto, setFullscreenPhoto] = useState<Photo | null>(null)

  const getPhotosForComparison = () => {
    // If a specific category is selected, compare within that category
    const targetCategory = selectedFilter !== 'all' ? selectedFilter : 'front'
    const categoryPhotos = photos.filter(p => p.category === targetCategory)
    if (categoryPhotos.length < 2) {
      // Try any category with 2+ photos
      for (const cat of ['front', 'side', 'back'] as const) {
        const catPhotos = photos.filter(p => p.category === cat)
        if (catPhotos.length >= 2) {
          const sorted = [...catPhotos].sort((a, b) =>
            parseISO(a.taken_at).getTime() - parseISO(b.taken_at).getTime()
          )
          return { before: sorted[0], after: sorted[sorted.length - 1] }
        }
      }
      return null
    }

    const sorted = [...categoryPhotos].sort((a, b) =>
      parseISO(a.taken_at).getTime() - parseISO(b.taken_at).getTime()
    )

    return {
      before: sorted[0],
      after: sorted[sorted.length - 1],
    }
  }

  const comparisonPhotos = getPhotosForComparison()

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Voortgangsfoto's</h2>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
          >
            <Camera size={18} />
            Foto toevoegen
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['all', 'front', 'side', 'back'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setSelectedFilter(filter)
                setShowCompare(false)
              }}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedFilter === filter
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700'
              }`}
            >
              {filter === 'all' ? 'Alle' : categoryLabels[filter as 'front' | 'side' | 'back']}
            </button>
          ))}
        </div>

        {/* Comparison Button */}
        {comparisonPhotos && !showCompare && (
          <button
            onClick={() => setShowCompare(true)}
            className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-orange-400 border border-zinc-700 rounded-lg font-medium transition-colors"
          >
            Voor/Na vergelijken
          </button>
        )}
      </div>

      {/* Comparison View */}
      {showCompare && comparisonPhotos && (
        <PhotoCompare
          beforePhoto={comparisonPhotos.before}
          afterPhoto={comparisonPhotos.after}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* Empty State */}
      {filteredPhotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <Camera className="text-zinc-600" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nog geen foto's</h3>
          <p className="text-zinc-400 mb-4">
            {selectedFilter === 'all'
              ? 'Begin met het uploaden van voortgangsfoto\'s om je transformatie bij te houden'
              : `Nog geen ${categoryLabels[selectedFilter]} foto's geüpload`}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
          >
            Upload je eerste foto
          </button>
        </div>
      ) : (
        /* Photos Timeline */
        <div className="space-y-8">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                {date}
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {groupedPhotos[date].map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 hover:border-orange-500/50 transition-colors"
                  >
                    {/* Image — click to fullscreen */}
                    <div
                      className="aspect-square overflow-hidden bg-zinc-900 cursor-pointer"
                      onClick={() => setFullscreenPhoto(photo)}
                    >
                      <img
                        src={photo.photo_url}
                        alt={`${categoryLabels[photo.category]} - ${date}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </div>

                    {/* Overlay Actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(photo.id) }}
                        className="p-1.5 bg-red-500/90 hover:bg-red-600 rounded-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-3 bg-zinc-900/80 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-400">
                          {format(parseISO(photo.taken_at), 'HH:mm', { locale: nl })}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${categoryColors[photo.category]}`}
                        >
                          {categoryLabels[photo.category]}
                        </span>
                      </div>
                      {photo.notes && (
                        <p className="text-xs text-zinc-300 line-clamp-2">{photo.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Photo Viewer */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            onClick={() => setFullscreenPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg transition-colors z-10"
          >
            <X size={24} className="text-white" />
          </button>
          <div className="max-w-4xl max-h-[90vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={fullscreenPhoto.photo_url}
              alt={categoryLabels[fullscreenPhoto.category]}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-3 text-center">
              <span className={`px-3 py-1 text-xs font-bold rounded-full border ${categoryColors[fullscreenPhoto.category]}`}>
                {categoryLabels[fullscreenPhoto.category]}
              </span>
              <p className="text-zinc-400 text-sm mt-2">
                {format(parseISO(fullscreenPhoto.taken_at), 'EEEE d MMMM yyyy · HH:mm', { locale: nl })}
              </p>
              {fullscreenPhoto.notes && (
                <p className="text-zinc-300 text-sm mt-1">{fullscreenPhoto.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Foto toevoegen</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadError('')
                }}
                className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-zinc-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Selecteer een foto
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setUploadFile(e.target.files?.[0] || null)
                      setUploadError('')
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center hover:border-orange-500/50 transition-colors">
                    {uploadFile ? (
                      <div className="text-sm text-green-400">
                        <p className="font-medium">{uploadFile.name}</p>
                        <p className="text-xs text-zinc-400">
                          {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="text-zinc-400">
                        <Upload size={24} className="mx-auto mb-2" />
                        <p className="text-sm">Klik om foto te selecteren</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Categorie
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['front', 'side', 'back'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setUploadCategory(cat)}
                      className={`py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                        uploadCategory === cat
                          ? 'bg-orange-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {categoryLabels[cat]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Aantekeningen (optioneel)
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Voeg notities toe..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 resize-none"
                  rows={3}
                />
              </div>

              {/* Error Message */}
              {uploadError && (
                <div className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {uploadError}
                </div>
              )}

              {/* Upload progress */}
              {uploadStage !== 'idle' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{uploadStageLabel[uploadStage]}</span>
                    <span className="text-xs text-zinc-500">{uploadStageProgress[uploadStage]}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${uploadStageProgress[uploadStage]}%` }}
                    />
                  </div>
                  {uploadFile && (
                    <p className="text-xs text-zinc-600">
                      {uploadFile.name} · {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadError('')
                    setUploadStage('idle')
                  }}
                  disabled={uploadStage !== 'idle'}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleUploadSubmit}
                  disabled={uploading || !uploadFile || uploadStage !== 'idle'}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {uploadStage !== 'idle' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {uploadStageLabel[uploadStage]}
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
