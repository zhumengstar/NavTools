export interface Group {
  id?: number;
  name: string;
  order_num: number;
  is_public?: number;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
  is_protected?: number;
  site_count?: number;
}

export interface Site {
  id?: number;
  group_id: number;
  name: string;
  url: string;
  icon: string;
  description: string;
  notes: string;
  account_username_encrypted?: string;
  account_password_encrypted?: string;
  order_num: number;
  is_public?: number;
  last_clicked_at?: string;
  created_at?: string;
  updated_at?: string;
  is_featured?: number;
  click_count?: number;
}
