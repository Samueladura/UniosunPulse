import {apiFetch, apiGet} from './api';

type ApiEnvelope<T> = {
  data: T;
  error?: {message?: string} | null;
};

export type CampusSearchType =
  | 'feed'
  | 'events'
  | 'marketplace'
  | 'jobs'
  | 'clubs';

export type CampusSearchResult = {
  id: string;
  item_type: 'post' | 'event' | 'marketplace' | 'career' | 'club';
  title: string;
  summary: string;
  meta: string;
  created_at: string;
};

export type CampusEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  attendee_count: number;
  is_going: boolean;
  status?: 'published' | 'cancelled';
};

export type AdminCampusEvent = Omit<CampusEvent, 'is_going'> & {
  status: 'published' | 'cancelled';
  created_by: string | null;
};

export type EventRsvp = {
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
};

export type MarketplaceListing = {
  id: string;
  seller_id: string;
  seller: string;
  title: string;
  description: string;
  category: string;
  price: number;
  location: string;
  image_urls: string[];
  created_at: string;
  is_owner: boolean;
};

export type SavedItem = {
  item_type: 'post' | 'event' | 'marketplace' | 'career' | 'club';
  item_id: string;
  title: string;
  summary: string;
  meta: string | null;
  created_at: string;
};

export type CareerOpportunity = {
  id: string;
  company: string;
  title: string;
  summary: string;
  type: string;
  mode: string;
  deadline: string | null;
  stipend: number | null;
  application_url: string | null;
  has_applied: boolean;
};

export type CampusClub = {
  id: string;
  name: string;
  description: string;
  focus: string;
  icon: string;
  member_count: number;
  is_member: boolean;
};

export type MarketplaceReport = {
  id: string;
  listing_id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'actioned' | 'dismissed';
  created_at: string;
  listing_title: string;
  listing_status: string;
  reporter_name: string | null;
  reporter_email: string;
};

async function unwrap<T>(request: Promise<ApiEnvelope<T>>): Promise<T> {
  const response = await request;
  if (response.error) {
    throw new Error(response.error.message || 'The campus request failed.');
  }
  return response.data;
}

export function searchCampus(
  query: string,
  type: CampusSearchType | 'all',
): Promise<CampusSearchResult[]> {
  return unwrap(
    apiGet<ApiEnvelope<CampusSearchResult[]>>('/campus/search', {
      q: query.trim(),
      type,
    }),
  );
}

export function fetchCampusEvents(): Promise<CampusEvent[]> {
  return unwrap(apiGet<ApiEnvelope<CampusEvent[]>>('/events'));
}

export function setEventRsvp(
  eventId: string,
  isGoing: boolean,
): Promise<{is_going: boolean; attendee_count: number}> {
  return unwrap(
    apiFetch<ApiEnvelope<{is_going: boolean; attendee_count: number}>>(
      `/events/${encodeURIComponent(eventId)}/rsvp`,
      {method: isGoing ? 'POST' : 'DELETE'},
    ),
  );
}

export function fetchAdminEvents(): Promise<AdminCampusEvent[]> {
  return unwrap(apiGet<ApiEnvelope<AdminCampusEvent[]>>('/admin/events'));
}

export function saveAdminEvent(
  event: Partial<AdminCampusEvent> & {
    title: string;
    venue: string;
    starts_at: string;
  },
  eventId?: string,
): Promise<AdminCampusEvent> {
  return unwrap(
    apiFetch<ApiEnvelope<AdminCampusEvent>>(
      eventId
        ? `/admin/events/${encodeURIComponent(eventId)}`
        : '/admin/events',
      {
        method: eventId ? 'PATCH' : 'POST',
        body: JSON.stringify(event),
      },
    ),
  );
}

export function removeAdminEvent(eventId: string): Promise<void> {
  return unwrap(
    apiFetch<ApiEnvelope<void>>(
      `/admin/events/${encodeURIComponent(eventId)}`,
      {method: 'DELETE'},
    ),
  );
}

export function fetchEventRsvps(eventId: string): Promise<EventRsvp[]> {
  return unwrap(
    apiGet<ApiEnvelope<EventRsvp[]>>(
      `/admin/events/${encodeURIComponent(eventId)}/rsvps`,
    ),
  );
}

export function removeEventRsvp(
  eventId: string,
  userId: string,
): Promise<void> {
  return unwrap(
    apiFetch<ApiEnvelope<void>>(
      `/admin/events/${encodeURIComponent(eventId)}/rsvps/${encodeURIComponent(
        userId,
      )}`,
      {method: 'DELETE'},
    ),
  );
}

export function fetchMarketplaceListings(): Promise<MarketplaceListing[]> {
  return unwrap(apiGet<ApiEnvelope<MarketplaceListing[]>>('/marketplace'));
}

export function createMarketplaceListing(input: {
  title: string;
  description: string;
  category: string;
  price: number;
  location: string;
  image_urls: string[];
}): Promise<MarketplaceListing> {
  return unwrap(
    apiFetch<ApiEnvelope<MarketplaceListing>>('/marketplace', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export function updateMarketplaceListing(
  listingId: string,
  input: {
    title: string;
    description: string;
    category: string;
    price: number;
    location: string;
    image_urls: string[];
  },
): Promise<MarketplaceListing> {
  return unwrap(
    apiFetch<ApiEnvelope<MarketplaceListing>>(
      `/marketplace/${encodeURIComponent(listingId)}`,
      {method: 'PATCH', body: JSON.stringify(input)},
    ),
  );
}

export function reportMarketplaceListing(
  listingId: string,
  reason: string,
  details: string,
): Promise<{id: string; reported: boolean}> {
  return unwrap(
    apiFetch<ApiEnvelope<{id: string; reported: boolean}>>(
      `/marketplace/${encodeURIComponent(listingId)}/report`,
      {method: 'POST', body: JSON.stringify({reason, details})},
    ),
  );
}

export function fetchMarketplaceReports(): Promise<MarketplaceReport[]> {
  return unwrap(
    apiGet<ApiEnvelope<MarketplaceReport[]>>('/admin/marketplace-reports'),
  );
}

export function reviewMarketplaceReport(
  reportId: string,
  status: 'actioned' | 'dismissed',
  removeListing = false,
): Promise<{status: 'actioned' | 'dismissed'; listing_removed: boolean}> {
  return unwrap(
    apiFetch<
      ApiEnvelope<{status: 'actioned' | 'dismissed'; listing_removed: boolean}>
    >(`/admin/marketplace-reports/${encodeURIComponent(reportId)}`, {
      method: 'PATCH',
      body: JSON.stringify({status, removeListing}),
    }),
  );
}

export function updateMarketplaceListingStatus(
  listingId: string,
  status: 'sold' | 'removed',
): Promise<{id: string; status: 'sold' | 'removed'}> {
  return unwrap(
    apiFetch<ApiEnvelope<{id: string; status: 'sold' | 'removed'}>>(
      `/marketplace/${encodeURIComponent(listingId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({status}),
      },
    ),
  );
}

export function fetchSavedItems(): Promise<SavedItem[]> {
  return unwrap(apiGet<ApiEnvelope<SavedItem[]>>('/saved'));
}

export function fetchSavedStatus(
  itemType: SavedItem['item_type'],
  itemId: string,
): Promise<{saved: boolean}> {
  return unwrap(
    apiGet<ApiEnvelope<{saved: boolean}>>(
      `/saved/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`,
    ),
  );
}

export function setItemSaved(
  itemType: SavedItem['item_type'],
  itemId: string,
  saved: boolean,
): Promise<{saved: boolean}> {
  const path = `/saved/${encodeURIComponent(itemType)}/${encodeURIComponent(
    itemId,
  )}`;
  return unwrap(
    saved
      ? apiFetch<ApiEnvelope<{saved: boolean}>>('/saved', {
          method: 'POST',
          body: JSON.stringify({item_type: itemType, item_id: itemId}),
        })
      : apiFetch<ApiEnvelope<{saved: boolean}>>(path, {method: 'DELETE'}),
  );
}

export function fetchCareerOpportunities(): Promise<CareerOpportunity[]> {
  return unwrap(apiGet<ApiEnvelope<CareerOpportunity[]>>('/career'));
}

export function applyToOpportunity(
  opportunityId: string,
): Promise<{has_applied: boolean}> {
  return unwrap(
    apiFetch<ApiEnvelope<{has_applied: boolean}>>(
      `/career/${encodeURIComponent(opportunityId)}/apply`,
      {method: 'POST'},
    ),
  );
}

export function fetchCampusClubs(): Promise<CampusClub[]> {
  return unwrap(apiGet<ApiEnvelope<CampusClub[]>>('/clubs'));
}

export function setClubMembership(
  clubId: string,
  isMember: boolean,
): Promise<{is_member: boolean; member_count: number}> {
  return unwrap(
    apiFetch<ApiEnvelope<{is_member: boolean; member_count: number}>>(
      `/clubs/${encodeURIComponent(clubId)}/join`,
      {method: isMember ? 'DELETE' : 'POST'},
    ),
  );
}
