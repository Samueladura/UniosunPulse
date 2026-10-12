import {backend, fetchUserProfile} from './backend';
import {apiFetch, apiGet} from './api';

type DataRow = Record<string, any>;

export interface VerificationRequest {
  id: string;
  userId: string;
  fullName: string;
  matricNumber: string;
  idCardUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
}

export interface ReportedPost {
  id: string;
  postId: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details?: string;
  postTitle?: string;
  postAuthor?: string;
  status: 'pending' | 'actioned' | 'dismissed';
  createdAt: string;
}

export interface AdminElection {
  id: string;
  title: string;
  category: 'SUG' | 'FACULTY' | 'DEPARTMENTAL';
  description?: string;
  status: 'draft' | 'active' | 'ended';
  startTime?: string;
  endTime?: string;
  maxCandidates?: number;
  totalVotes: number;
  candidatesCount: number;
  createdAt: string;
}

export interface ElectionCandidate {
  id: string;
  electionId: string;
  name: string;
  position: string;
  manifesto?: string;
  avatarUrl?: string;
  voteCount: number;
}

export interface AdminMetrics {
  totalStudents: number;
  pendingVerifications: number;
  flaggedPosts: number;
  activeElections: number;
  alertsSentToday: number;
}

export interface AuditLog {
  id: string;
  action: string;
  adminName: string;
  details: any;
  createdAt: string;
}

export const adminService = {
  // 1. Overview Metrics
  async getDashboardMetrics(): Promise<AdminMetrics> {
    try {
      const {data: verifications} = await backend
        .from('student_verifications')
        .select('id, status');

      const {data: reports} = await backend
        .from('reported_posts')
        .select('id, status');

      const {data: elections} = await backend
        .from('elections')
        .select('id, status');

      let totalStudents = 0;
      try {
        const {count} = await backend
          .from('profiles')
          .select('*', {count: 'exact', head: true});
        if (count && count > 0) {
          totalStudents = count;
        }
      } catch {
        // profiles table may not exist
      }

      const pendingV = verifications
        ? verifications.filter((v: any) => v.status === 'pending').length
        : 0;

      const flaggedP = reports
        ? reports.filter((r: any) => r.status === 'pending').length
        : 0;

      const activeE = elections
        ? elections.filter((e: any) => e.status === 'active').length
        : 0;

      return {
        totalStudents,
        pendingVerifications: pendingV,
        flaggedPosts: flaggedP,
        activeElections: activeE,
        alertsSentToday: 0,
      };
    } catch {
      return {
        totalStudents: 0,
        pendingVerifications: 0,
        flaggedPosts: 0,
        activeElections: 0,
        alertsSentToday: 0,
      };
    }
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const {data, error} = await backend
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', {ascending: false})
        .limit(50);

      if (error || !data) {
        return [];
      }

      return data.map((item: DataRow) => ({
        id: item.id,
        action: item.action,
        adminName: item.admin_name,
        details: item.details,
        createdAt: item.created_at,
      }));
    } catch {
      return [];
    }
  },

  // 2. Student Verifications
  async getVerifications(): Promise<VerificationRequest[]> {
    try {
      const {data, error} = await backend
        .from('student_verifications')
        .select('*')
        .order('created_at', {ascending: false});

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((item: DataRow) => ({
        id: item.id,
        userId: item.user_id,
        fullName: item.full_name,
        matricNumber: item.matric_number,
        status: item.status,
        rejectionReason: item.rejection_reason,
        createdAt: item.created_at,
      }));
    } catch {
      return [];
    }
  },

  async updateVerificationStatus(
    id: string,
    status: 'approved' | 'rejected',
    reason?: string,
  ): Promise<boolean> {
    try {
      await backend
        .from('student_verifications')
        .update({
          status,
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      return true;
    } catch {
      return false;
    }
  },

  // 3. Content Moderation
  async getReportedPosts(): Promise<ReportedPost[]> {
    try {
      const response = await apiGet<{
        data: any[];
        error?: {message?: string} | null;
      }>('/reported-posts');

      if (response.error || !response.data || response.data.length === 0) {
        return [];
      }

      return response.data.map((item: any) => ({
        id: item.id,
        postId: item.post_id,
        reporterId: item.reporter_id,
        reporterName: item.reporter_name || 'Student',
        reason: item.reason,
        details: item.details,
        status: item.status,
        createdAt: item.created_at,
        postTitle: item.post_title,
        postAuthor: item.post_author,
      }));
    } catch {
      return [];
    }
  },

  async resolveReportedPost(
    reportId: string,
    action: 'actioned' | 'dismissed',
  ): Promise<boolean> {
    try {
      const response = await apiFetch<{
        data: any;
        error?: {message?: string} | null;
      }>(`/reported-posts/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        body: JSON.stringify({status: action}),
      });

      if (response.error) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  // 4. Broadcast Alerts + Feed post
  async sendBroadcastAlert(
    category: string,
    title: string,
    body: string,
  ): Promise<boolean> {
    try {
      const {error: alertError} = await backend.from('alerts').insert([
        {
          user_id: 'ALL_STUDENTS',
          category,
          title,
          body,
          unread: true,
          is_broadcast: true,
        },
      ]);

      if (alertError) {
        console.error(
          'Failed to insert broadcast alert:',
          JSON.stringify(alertError, null, 2),
        );
        return false;
      }

      const tag = category === 'EMERGENCY' ? 'EMERGENCY' : 'BROADCAST';
      const {
        data: {user},
      } = await backend.auth.getUser();
      const adminProfile = user ? await fetchUserProfile() : null;
      const adminAvatar = adminProfile?.avatar_url || null;
      const adminName = 'Campus Admin (Official)';
      const {error: postError} = await backend.from('posts').insert([
        {
          author_id: 'admin_official',
          author_name: adminName,
          avatar: adminAvatar,
          title,
          body,
          tag,
          like_count: 0,
          comment_count: 0,
        },
      ]);

      if (postError) {
        console.error(
          'Failed to insert broadcast post:',
          JSON.stringify(postError, null, 2),
        );
      }

      return true;
    } catch (error) {
      console.error('Failed to send broadcast alert:', error);
      return false;
    }
  },

  // 5. Elections Management
  async getAdminElections(): Promise<AdminElection[]> {
    try {
      const {data, error} = await backend
        .from('elections')
        .select('*')
        .order('created_at', {ascending: false});

      if (error || !data || data.length === 0) {
        return [];
      }

      const result: AdminElection[] = [];
      for (const item of data) {
        let candidatesCount = 0;
        let totalVotes = 0;
        try {
          const {count} = await backend
            .from('election_candidates')
            .select('*', {count: 'exact', head: true})
            .eq('election_id', item.id);
          candidatesCount = count || 0;
        } catch {
          // ignore
        }

        try {
          const {data: cands} = await backend
            .from('election_candidates')
            .select('vote_count')
            .eq('election_id', item.id);
          totalVotes =
            cands?.reduce(
              (sum: number, c: any) => sum + (c.vote_count || 0),
              0,
            ) || 0;
        } catch {
          // ignore
        }

        result.push({
          id: item.id,
          title: item.title,
          category: item.category,
          description: item.description,
          status: item.status,
          startTime: item.start_time,
          endTime: item.end_time,
          totalVotes,
          candidatesCount,
          createdAt: item.created_at,
        });
      }

      return result;
    } catch {
      return [];
    }
  },

  async createElection(
    title: string,
    category: 'SUG' | 'FACULTY' | 'DEPARTMENTAL',
    description: string,
    startTime?: string,
    endTime?: string,
    maxCandidates?: number,
  ): Promise<AdminElection> {
    // Determine initial status based on start time
    let initialStatus: 'draft' | 'active' = 'draft';
    if (startTime) {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      if (start <= now) {
        initialStatus = 'active';
      }
    } else {
      // No start time specified, default to active immediately
      initialStatus = 'active';
    }

    const {data, error} = await backend
      .from('elections')
      .insert([
        {
          title,
          category,
          description,
          status: initialStatus,
          start_time: startTime || null,
          end_time: endTime || null,
          start_at: startTime || null,
          end_at: endTime || null,
          max_candidates: maxCandidates || null,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create election.');
    }
    return {
      id: data.id,
      title: data.title,
      category: data.category,
      description: data.description,
      status: data.status,
      startTime: data.start_time,
      endTime: data.end_time,
      totalVotes: data.total_votes || 0,
      candidatesCount: 0,
      createdAt: data.created_at,
    };
  },

  async updateElectionStatus(
    id: string,
    status: 'draft' | 'active' | 'ended',
  ): Promise<boolean> {
    try {
      await backend.from('elections').update({status}).eq('id', id);
      return true;
    } catch {
      return false;
    }
  },

  async getCandidates(electionId: string): Promise<ElectionCandidate[]> {
    try {
      const {data, error} = await backend
        .from('election_candidates')
        .select('*')
        .eq('election_id', electionId)
        .order('created_at', {ascending: true});

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((item: DataRow) => ({
        id: item.id,
        electionId: item.election_id,
        name: item.name,
        position: item.position,
        manifesto: item.manifesto,
        avatarUrl: item.avatar_url,
        voteCount: item.vote_count || 0,
      }));
    } catch {
      return [];
    }
  },

  async addCandidate(
    electionId: string,
    name: string,
    position: string,
    manifesto?: string,
    avatarUrl?: string,
  ): Promise<ElectionCandidate> {
    const {data, error} = await backend
      .from('election_candidates')
      .insert([
        {
          election_id: electionId,
          name,
          position,
          manifesto,
          avatar_url: avatarUrl,
        },
      ])
      .select()
      .single();
    if (error || !data) {
      throw new Error(error?.message || 'Failed to add the election candidate.');
    }

    return {
      id: data.id,
      electionId: data.election_id,
      name: data.name,
      position: data.position,
      manifesto: data.manifesto ?? undefined,
      avatarUrl: data.avatar_url ?? undefined,
      voteCount: data.vote_count ?? 0,
    };
  },

  async deleteCandidate(id: string): Promise<boolean> {
    try {
      await backend.from('election_candidates').delete().eq('id', id);
      return true;
    } catch {
      return false;
    }
  },

  async deleteElection(id: string): Promise<boolean> {
    try {
      await backend.from('election_candidates').delete().eq('election_id', id);
      await backend.from('elections').delete().eq('id', id);
      return true;
    } catch {
      return false;
    }
  },

  async syncElectionStatuses(): Promise<boolean> {
    try {
      await apiFetch('/admin/elections/sync-status', {method: 'POST'});
      return true;
    } catch {
      return false;
    }
  },

  async getElectionResults(electionId: string) {
    try {
      const {data, error} = await backend
        .from('election_candidates')
        .select('id, name, avatar_url, vote_count')
        .eq('election_id', electionId)
        .order('vote_count', {ascending: false});

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((item: DataRow) => ({
        id: item.id,
        candidateId: item.id,
        name: item.name,
        photo_url: item.avatar_url,
        votes: item.vote_count || 0,
      }));
    } catch {
      return [];
    }
  },
};
