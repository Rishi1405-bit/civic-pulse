/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Timestamp } from 'firebase/firestore';

export type IssueStatus = 'reported' | 'in-progress' | 'resolved';

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: IssueStatus;
  authorId: string;
  authorName: string;
  voteCount: number;
  photoData?: string | null;
  locationAddress?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type VoteType = 'up' | 'down';

export interface Vote {
  type: VoteType;
  userId: string;
  timestamp: Timestamp;
}
