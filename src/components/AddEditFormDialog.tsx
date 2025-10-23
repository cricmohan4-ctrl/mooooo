"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, XCircle, Type, Hash, Mail, AlignLeft } from "lucide-react"; // Changed TextareaIcon to AlignLeft
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { showSuccess, showError } from "@/utils/toast";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField } from '@/types/form';

interface AddEditFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFormSaved: () => void;
  initialForm?: Form | null; // Optional prop for editing existing forms
}

const AddEditFormDialog: React.FC<AddEditFormDialogProps> = ({
  isOpen,
  onOpenChange,
  onFormSaved,
  initialForm,
}) => {
  const { user } = useSession();
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialForm) {
      setFormName(initialForm.name);
      setFormDescription(initialForm.description || "");
      setFormFields(initialForm.form_definition || []);
    } else {
      // Reset for new form
      setFormName("");
      setFormDescription("");
      setFormFields([]);
    }
  }, [initialForm, isOpen]); // Reset when dialog opens or initialForm changes

  const handleAddField = () => {
    setFormFields([...formFields, { id: `field_${Date.now()}`, label: "", type: "text", required: false, placeholder: "" }]);
  };

  const handleRemoveField = (index: number) => {
    setFormFields(formFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: keyof FormField, value: any) => {
    const newFields = [...formFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setFormFields(newFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to save a form.");
      return;
    }
    if (!formName.trim()) {
      showError("Form name cannot be empty.");
      return;
    }
    if (formFields.some(field => !field.label.trim())) {
      showError("All form fields must have a label.");
      return;
    }

    setIsLoading(true);
    try {
      const formPayload = {
        user_id: user.id, // RLS will handle this based on admin role
        name: formName.trim(),
        description: formDescription.trim() || null,
        form_definition: formFields,
      };

      if (initialForm) {
        // Update existing form
        const { error } = await supabase
          .from("forms")
          .update({ ...formPayload, updated_at: new Date().toISOString() })
          .eq("id", initialForm.id);

        if (error) throw error;
        showSuccess("Form updated successfully!");
      } else {
        // Insert new form
        const { error } = await supabase
          .from("forms")
          .insert(formPayload);

        if (error) throw error;
        showSuccess("Form created successfully!");
      }

      onOpenChange(false);
      onFormSaved();
    } catch (error: any) {
      console.error("Error saving form:", error.message);
      showError(`Failed to save form: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialForm ? "Edit Form" : "Create New Form"}</DialogTitle>
          <DialogDescription>
            Define the structure of your form by adding fields.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="formName" className="text-right">
                Form Name
              </Label>
              <Input
                id="formName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Customer Address Form"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="formDescription" className="text-right">
                Description
              </Label>
              <Textarea
                id="formDescription"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="col-span-3"
                placeholder="Optional description for your form"
                rows={2}
              />
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Form Fields</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddField}>
                <PlusCircle className="h-4 w-4 mr-2" /> Add Field
              </Button>
            </div>

            {formFields.length === 0 ? (
              <p className="text-sm text-gray-500 text-center">No fields added yet. Click "Add Field" to start.</p>
            ) : (
              <div className="space-y-4">
                {formFields.map((field, index) => (
                  <Card key={field.id} className="p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">Field {index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveField(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4 mb-2">
                      <Label htmlFor={`field-label-${index}`} className="text-right text-sm">
                        Label
                      </Label>
                      <Input
                        id={`field-label-${index}`}
                        value={field.label}
                        onChange={(e) => handleFieldChange(index, "label", e.target.value)}
                        className="col-span-3"
                        placeholder="e.g., Full Name"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4 mb-2">
                      <Label htmlFor={`field-type-${index}`} className="text-right text-sm">
                        Type
                      </Label>
                      <Select
                        value={field.type}
                        onValueChange={(value: FormField['type']) => handleFieldChange(index, "type", value)}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select field type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">
                            <div className="flex items-center"><Type className="h-4 w-4 mr-2" /> Text</div>
                          </SelectItem>
                          <SelectItem value="number">
                            <div className="flex items-center"><Hash className="h-4 w-4 mr-2" /> Number</div>
                          </SelectItem>
                          <SelectItem value="email">
                            <div className="flex items-center"><Mail className="h-4 w-4 mr-2" /> Email</div>
                          </SelectItem>
                          <SelectItem value="textarea">
                            <div className="flex items-center"><AlignLeft className="h-4 w-4 mr-2" /> Text Area</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4 mb-2">
                      <Label htmlFor={`field-placeholder-${index}`} className="text-right text-sm">
                        Placeholder
                      </Label>
                      <Input
                        id={`field-placeholder-${index}`}
                        value={field.placeholder || ""}
                        onChange={(e) => handleFieldChange(index, "placeholder", e.target.value)}
                        className="col-span-3"
                        placeholder="e.g., Enter your full name"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor={`field-required-${index}`} className="text-right text-sm">
                        Required
                      </Label>
                      <div className="col-span-3 flex items-center space-x-2">
                        <Checkbox
                          id={`field-required-${index}`}
                          checked={field.required}
                          onCheckedChange={(checked) => handleFieldChange(index, "required", checked)}
                        />
                        <label htmlFor={`field-required-${index}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          This field is required
                        </label>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditFormDialog;