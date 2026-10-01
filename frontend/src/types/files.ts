export interface DiffProposal {
  proposal_id: string;
  file_path: string;
  diff: string;
  old_text?: string;
  new_text?: string;
  created_at?: string;
}

export interface FileBackup {
  backup_id: string;
  file_path: string;
  backup_path: string;
  created_at: string;
}

export interface FileMetadata {
  path: string;
  name: string;
  size: number;
  modified: string;
  is_dir: boolean;
  classification?: string;
}
