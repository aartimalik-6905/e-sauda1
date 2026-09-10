import { useEffect, useState } from 'react'
import { MapPin, Calendar, Car, Check, X, Navigation } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchMeetup, proposeMeetup, confirmMeetup, cancelMeetup, Meetup } from '../lib/meetups'
import { getCurrentLocation, buildUberRideLink, getRapidoLink } from '../lib/rideLinks'
import { reverseGeocode } from '../lib/geocoding'
import { describeSupabaseError } from '../lib/errors'

function formatMeetupTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Formats a Date as the local "YYYY-MM-DDTHH:mm" string a <input type="datetime-local">
// expects for its `value`/`min` -- note this is LOCAL time, not UTC, so a naive
// `.toISOString().slice(0, 16)` would be off by the browser's timezone offset.
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function MeetupPlanner({
  vaultOrderId,
  otherPartyLabel,
}: {
  vaultOrderId: string
  otherPartyLabel: string
}) {
  const { user } = useAuth()
  const [meetup, setMeetup] = useState<Meetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  // The human-readable place name for `coords`, resolved via reverse geocoding --
  // shown on screen so "attach current location" doesn't leave the person looking at
  // a bare checkmark with no idea what got attached.
  const [coordsLabel, setCoordsLabel] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gettingRide, setGettingRide] = useState(false)

  useEffect(() => {
    fetchMeetup(vaultOrderId)
      .then(setMeetup)
      .catch(() => setMeetup(null))
      .finally(() => setLoading(false))
  }, [vaultOrderId])

  function startEditing() {
    if (meetup) {
      // Pre-fill with the existing proposal so a "propose a different time" edit
      // starts from what's already there instead of a blank form.
      setDateInput(meetup.meetupAt.slice(0, 16))
      setLocationInput(meetup.locationName)
      const existingCoords =
        meetup.locationLat != null && meetup.locationLng != null
          ? { lat: meetup.locationLat, lng: meetup.locationLng }
          : null
      setCoords(existingCoords)
      setCoordsLabel(null)
      if (existingCoords) reverseGeocode(existingCoords).then(setCoordsLabel).catch(() => {})
    } else {
      setCoords(null)
      setCoordsLabel(null)
    }
    setError(null)
    setEditing(true)
  }

  async function handleUseCurrentLocation() {
    setLocating(true)
    setError(null)
    setCoordsLabel(null)
    try {
      const point = await getCurrentLocation()
      setCoords(point)
      // Best-effort -- if reverse geocoding fails or is slow, the coordinates are
      // still attached and usable, we just won't have a nice label to show for it.
      const label = await reverseGeocode(point)
      if (label) {
        setCoordsLabel(label)
        // Auto-fill the "where" field with the resolved place name if the person
        // hasn't already typed their own description, so they're not left staring
        // at an empty required field after using this button.
        if (!locationInput.trim()) setLocationInput(label)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLocating(false)
    }
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !locationInput.trim()) return
    // datetime-local's native `required` should already prevent an empty/invalid
    // value reaching here, but a defensive check keeps a mistyped or cleared value
    // from turning into a raw "Invalid time value" error further down.
    const meetupDate = dateInput ? new Date(dateInput) : null
    if (!meetupDate || Number.isNaN(meetupDate.getTime())) {
      setError('Please choose a valid date and time.')
      return
    }
    // A meetup proposed for the past, or minutes from now, isn't something either
    // side could realistically act on -- the other party needs some real time to
    // see the proposal and get there. Mirrors the `min` on the input below (which
    // stops most people from picking an invalid time in the first place) with a
    // server-independent check here, since `min` is only advisory -- browsers don't
    // enforce it the way `required` enforces non-empty.
    if (meetupDate.getTime() < minMeetupDate.getTime()) {
      setError('Pick a time at least 1 hour from now, so there\'s time to actually get there.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await proposeMeetup({
        vaultOrderId,
        proposedBy: user.id,
        meetupAt: meetupDate.toISOString(),
        locationName: locationInput.trim(),
        locationLat: coords?.lat,
        locationLng: coords?.lng,
      })
      setMeetup(result)
      setEditing(false)
    } catch (err: any) {
      setError(describeSupabaseError(err, 'Could not save this meetup.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      setMeetup(await confirmMeetup(vaultOrderId))
    } catch (err: any) {
      setError(describeSupabaseError(err, 'Could not confirm.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    setSaving(true)
    setError(null)
    try {
      setMeetup(await cancelMeetup(vaultOrderId))
    } catch (err: any) {
      setError(describeSupabaseError(err, 'Could not cancel.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleGetUberRide(dropoffLat: number, dropoffLng: number, label: string) {
    setGettingRide(true)
    setError(null)
    try {
      const pickup = await getCurrentLocation()
      window.open(buildUberRideLink(pickup, { lat: dropoffLat, lng: dropoffLng }, label), '_blank')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGettingRide(false)
    }
  }

  if (loading) return null

  const isProposer = meetup?.proposedBy === user?.id
  // Recomputed on every render (cheap) rather than memoized once, so it stays
  // accurate to the actual current time for however long this form stays open --
  // a memoized value would go stale and let someone submit a "1 hour from now"
  // time that's actually in the past by the time they hit Propose.
  const minMeetupDate = new Date(Date.now() + 60 * 60 * 1000)

  return (
    <div className="mt-4 border-t border-line/5 pt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/50">
        <Calendar size={12} /> Meetup
      </p>

      {editing ? (
        <form onSubmit={handlePropose} className="mt-2 space-y-2">
          <input
            type="datetime-local"
            required
            min={toDatetimeLocalValue(minMeetupDate)}
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="bg-surface text-ink w-full rounded-lg border border-line/10 px-3 py-2 text-xs"
          />
          <p className="text-[11px] text-ink/40">Must be at least 1 hour from now.</p>
          <input
            required
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            placeholder="Where? e.g. Cafe Coffee Day, Sector 18 metro gate"
            className="bg-surface text-ink w-full rounded-lg border border-line/10 px-3 py-2 text-xs"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="flex items-center gap-1 rounded-full border border-line/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink/60 hover:bg-cream-dark disabled:opacity-50"
            >
              <Navigation size={11} /> {locating ? 'Locating…' : coords ? 'Update my current location' : 'Attach my current location'}
            </button>
          </div>
          {coords ? (
            <p className="flex items-center gap-1 text-[11px] text-emerald-500">
              <Check size={11} className="shrink-0" />
              {coordsLabel ? (
                <span>
                  Location attached: <span className="font-medium">{coordsLabel}</span>
                </span>
              ) : (
                'Location attached'
              )}
            </p>
          ) : (
            <p className="text-[11px] text-ink/40">
              Optional -- without this, "Get a ride there" won't be available, but the meetup itself still works fine with just a description.
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-forest px-4 py-1.5 text-xs font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Propose'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-line/10 px-4 py-1.5 text-xs font-semibold text-ink/60"
            >
              Never mind
            </button>
          </div>
        </form>
      ) : !meetup || meetup.status === 'cancelled' ? (
        <div className="mt-2">
          {meetup?.status === 'cancelled' && (
            <p className="text-xs text-ink/50">The last planned meetup was cancelled.</p>
          )}
          <button
            onClick={startEditing}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-dark"
          >
            <MapPin size={12} /> Propose a time &amp; place to meet
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm font-medium text-ink">{formatMeetupTime(meetup.meetupAt)}</p>
          <p className="text-xs text-ink/60">{meetup.locationName}</p>
          <p className="mt-1 text-[11px] text-ink/40">
            {meetup.status === 'confirmed'
              ? 'Confirmed by both of you'
              : isProposer
                ? `Waiting for ${otherPartyLabel} to confirm`
                : `Proposed by ${otherPartyLabel}`}
          </p>

          {error && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-400">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {meetup.status === 'proposed' && !isProposer && (
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-cream hover:bg-forest-light disabled:opacity-50"
              >
                <Check size={12} /> Confirm
              </button>
            )}
            <button
              onClick={startEditing}
              className="rounded-full border border-line/10 px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-cream-dark"
            >
              Propose different time
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              <X size={12} /> Cancel
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {meetup.locationLat != null && meetup.locationLng != null ? (
              <button
                onClick={() => handleGetUberRide(meetup.locationLat!, meetup.locationLng!, meetup.locationName)}
                disabled={gettingRide}
                className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-dark disabled:opacity-50"
              >
                <Car size={12} /> {gettingRide ? 'Getting your location…' : 'Get an Uber there'}
              </button>
            ) : (
              <p className="text-[11px] text-ink/40">
                Attach a location to the meetup to enable one-tap ride booking.
              </p>
            )}
            <a
              href={getRapidoLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-line/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-dark"
            >
              <Car size={12} /> Open Rapido
            </a>
          </div>
          <p className="mt-1 text-[10px] text-ink/35">
            Uber opens with your route pre-filled. Rapido doesn't currently support that, so it just opens the app/site.
          </p>
        </div>
      )}
    </div>
  )
}
