export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RequestStatus =
  | "Need to Order"
  | "Ordered"
  | "Waiting on Vendor"
  | "Backordered"
  | "Shipped"
  | "Received"
  | "Cancelled";

export type RequestPriority = "Emergency" | "Today" | "This Week" | "Whenever";

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          name: string;
          department: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          department?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          department?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vendors: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          website: string | null;
          sales_rep: string | null;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          sales_rep?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          sales_rep?: string | null;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      equipment: {
        Row: {
          id: string;
          equipment_number: string;
          description: string | null;
          active: boolean;
          prefix: string | null;
          unit_number: string | null;
          make: string | null;
          model: string | null;
          model_year: string | null;
          serial_number: string | null;
          driver: string | null;
          inspection_required: string | null;
          last_service_date: string | null;
          last_service_mileage: number | null;
          parts_ordered: string | null;
          notes: string | null;
          source_row_id: string | null;
          imported_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          equipment_number: string;
          description?: string | null;
          active?: boolean;
          prefix?: string | null;
          unit_number?: string | null;
          make?: string | null;
          model?: string | null;
          model_year?: string | null;
          serial_number?: string | null;
          driver?: string | null;
          inspection_required?: string | null;
          last_service_date?: string | null;
          last_service_mileage?: number | null;
          parts_ordered?: string | null;
          notes?: string | null;
          source_row_id?: string | null;
          imported_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          equipment_number?: string;
          description?: string | null;
          active?: boolean;
          prefix?: string | null;
          unit_number?: string | null;
          make?: string | null;
          model?: string | null;
          model_year?: string | null;
          serial_number?: string | null;
          driver?: string | null;
          inspection_required?: string | null;
          last_service_date?: string | null;
          last_service_mileage?: number | null;
          parts_ordered?: string | null;
          notes?: string | null;
          source_row_id?: string | null;
          imported_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      requests: {
        Row: {
          id: string;
          request_number: string | null;
          requested_by_employee_id: string | null;
          item_description: string;
          equipment_number: string | null;
          priority: RequestPriority;
          status: RequestStatus;
          vendor_id: string | null;
          vendor_name_override: string | null;
          order_number: string | null;
          quantity: number | null;
          unit_cost: number | null;
          total_cost: number | null;
          eta: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          notes: string | null;
          requested_at: string;
          ordered_at: string | null;
          received_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_number?: string | null;
          requested_by_employee_id?: string | null;
          item_description: string;
          equipment_number?: string | null;
          priority?: RequestPriority;
          status?: RequestStatus;
          vendor_id?: string | null;
          vendor_name_override?: string | null;
          order_number?: string | null;
          quantity?: number | null;
          unit_cost?: number | null;
          total_cost?: number | null;
          eta?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          notes?: string | null;
          requested_at?: string;
          ordered_at?: string | null;
          received_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          request_number?: string | null;
          requested_by_employee_id?: string | null;
          item_description?: string;
          equipment_number?: string | null;
          priority?: RequestPriority;
          status?: RequestStatus;
          vendor_id?: string | null;
          vendor_name_override?: string | null;
          order_number?: string | null;
          quantity?: number | null;
          unit_cost?: number | null;
          total_cost?: number | null;
          eta?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          notes?: string | null;
          requested_at?: string;
          ordered_at?: string | null;
          received_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requests_requested_by_employee_id_fkey";
            columns: ["requested_by_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "requests_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      request_activity: {
        Row: {
          id: string;
          request_id: string;
          action: string;
          field_name: string | null;
          old_value: string | null;
          new_value: string | null;
          performed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          action: string;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          performed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          action?: string;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          performed_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_activity_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_history: {
        Row: {
          id: string;
          equipment_number: string | null;
          part_description: string | null;
          part_number: string | null;
          vendor_name: string | null;
          purchase_date: string | null;
          quantity: number | null;
          unit_cost: number | null;
          total_cost: number | null;
          po_number: string | null;
          invoice_number: string | null;
          notes: string | null;
          source_row_id: string | null;
          imported_at: string;
        };
        Insert: {
          id?: string;
          equipment_number?: string | null;
          part_description?: string | null;
          part_number?: string | null;
          vendor_name?: string | null;
          purchase_date?: string | null;
          quantity?: number | null;
          unit_cost?: number | null;
          total_cost?: number | null;
          po_number?: string | null;
          invoice_number?: string | null;
          notes?: string | null;
          source_row_id?: string | null;
          imported_at?: string;
        };
        Update: {
          id?: string;
          equipment_number?: string | null;
          part_description?: string | null;
          part_number?: string | null;
          vendor_name?: string | null;
          purchase_date?: string | null;
          quantity?: number | null;
          unit_cost?: number | null;
          total_cost?: number | null;
          po_number?: string | null;
          invoice_number?: string | null;
          notes?: string | null;
          source_row_id?: string | null;
          imported_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_requests: {
        Args: {
          p_search?: string | null;
          p_employee_id?: string | null;
          p_vendor_id?: string | null;
          p_status?: RequestStatus | null;
          p_priority?: RequestPriority | null;
          p_equipment_number?: string | null;
          p_requested_from?: string | null;
          p_requested_to?: string | null;
          p_eta_from?: string | null;
          p_eta_to?: string | null;
          p_received_from?: string | null;
          p_received_to?: string | null;
          p_overdue_eta?: boolean;
          p_show_completed?: boolean;
          p_sort?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          request_number: string | null;
          requested_by_employee_id: string | null;
          employee_name: string | null;
          employee_department: string | null;
          item_description: string;
          equipment_number: string | null;
          priority: RequestPriority;
          status: RequestStatus;
          vendor_id: string | null;
          vendor_name: string | null;
          vendor_name_override: string | null;
          order_number: string | null;
          quantity: number | null;
          unit_cost: number | null;
          total_cost: number | null;
          eta: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          notes: string | null;
          requested_at: string;
          ordered_at: string | null;
          received_at: string | null;
          created_at: string;
          updated_at: string;
          total_count: number;
        }[];
      };
      get_purchasing_dashboard: {
        Args: {
          p_today?: string;
        };
        Returns: {
          counts?: {
            need_to_order?: number;
            ordered?: number;
            waiting_on_vendor?: number;
            backordered?: number;
            arriving_today?: number;
            overdue_eta?: number;
            received_today?: number;
          };
          emergency_requests?: DashboardRequest[];
          oldest_need_to_order?: DashboardRequest[];
          overdue_etas?: DashboardRequest[];
          recent_activity?: DashboardActivity[];
          open_by_employee?: DashboardEmployeeGroup[];
          open_by_vendor?: DashboardVendorGroup[];
        };
      };
      search_equipment_with_parts: {
        Args: {
          p_search?: string | null;
          p_limit?: number;
        };
        Returns: EquipmentSearchResult;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type DashboardRequest = {
  id: string;
  request_number: string | null;
  item_description: string;
  equipment_number: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  employee_name: string | null;
  vendor_name: string | null;
  requested_at: string;
  eta: string | null;
};

export type DashboardActivity = {
  id: string;
  request_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  request_number: string | null;
  item_description: string;
};

export type DashboardEmployeeGroup = {
  employee_id: string | null;
  employee_name: string;
  request_count: number;
};

export type DashboardVendorGroup = {
  vendor_id: string | null;
  vendor_name: string;
  request_count: number;
};

export type EquipmentSearchResult = {
  equipment?: EquipmentSummary[];
  requests?: EquipmentRequestHistory[];
  purchase_history?: EquipmentPurchaseHistory[];
};

export type EquipmentSummary = {
  id: string | null;
  equipment_number: string;
  description: string | null;
  active: boolean;
  prefix: string | null;
  unit_number: string | null;
  make: string | null;
  model: string | null;
  model_year: string | null;
  serial_number: string | null;
  driver: string | null;
  inspection_required: string | null;
  last_service_date: string | null;
  last_service_mileage: number | null;
  parts_ordered: string | null;
  notes: string | null;
  source: "equipment" | "requests" | "purchase_history";
};

export type EquipmentRequestHistory = {
  id: string;
  request_number: string | null;
  equipment_number: string | null;
  item_description: string;
  status: RequestStatus;
  priority: RequestPriority;
  vendor_name_override: string | null;
  vendor_name: string | null;
  order_number: string | null;
  quantity: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  requested_at: string;
  ordered_at: string | null;
  received_at: string | null;
  eta: string | null;
};

export type EquipmentPurchaseHistory = {
  id: string;
  equipment_number: string | null;
  part_description: string | null;
  part_number: string | null;
  vendor_name: string | null;
  purchase_date: string | null;
  quantity: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  po_number: string | null;
  invoice_number: string | null;
  notes: string | null;
};
