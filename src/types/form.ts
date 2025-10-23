export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea'; // Basic types for now
  required: boolean;
  placeholder?: string;
}

export interface Form {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  form_definition: FormField[];
  created_at: string;
  updated_at: string;
}