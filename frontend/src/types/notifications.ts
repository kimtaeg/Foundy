export interface NotificationSummary {
  id: string;
  title: string;
  body: string;
  category: string;
  read: boolean;
  destination: string;
  focus: string;
}

export interface NotificationFetchStatus {
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
}
