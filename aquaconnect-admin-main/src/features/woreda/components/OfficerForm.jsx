"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  OFFICER_TYPE_OPTIONS,
  getOfficerTypeSelectLabel,
} from "@/features/woreda/constants/officerTypes";

const EMPTY_FORM_VALUES = {
  fullName: "",
  email: "",
  phoneNumber: "",
  nationalId: "",
  fieldOfficerType: "",
  password: "",
};

export default function OfficerForm({
  onSubmit,
  defaultValues,
  loading,
  typeOptions = OFFICER_TYPE_OPTIONS,
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: EMPTY_FORM_VALUES,
  onValidationError,
  strictValidation = false,
    shouldUnregister: true,
  });

  useEffect(() => {
    const nextValues = defaultValues
      ? {
          fullName: defaultValues.fullName ?? "",
          email: defaultValues.email ?? "",
    watch,
          phoneNumber: defaultValues.phoneE164 ?? "",
          nationalId: defaultValues.nationalId ?? "",
          fieldOfficerType: defaultValues.fieldOfficerType ?? "",
          password: "",
        }
      : { ...EMPTY_FORM_VALUES };
  const passwordValue = watch("password", "");

  const passwordStrength = useMemo(() => {
    if (isEditMode) {
      return { score: 0, percent: 0, label: "", colorClass: "" };
    }

    let score = 0;
    if (passwordValue.length >= 8) score += 1;
    if (/[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue)) score += 1;
    if (/[0-9]/.test(passwordValue)) score += 1;
    if (/[!@#$%^&*]/.test(passwordValue)) score += 1;

    const percent = score === 0 ? 0 : Math.round((score / 4) * 100);

    if (score <= 1) {
      return {
        score,
        percent,
        label: "Weak",
        colorClass: "bg-[#b83a3a]",
      };
    }

    if (score <= 2) {
      return {
        score,
        percent,
        label: "Fair",
        colorClass: "bg-[#d88a2b]",
      };
    }

    if (score <= 3) {
      return {
        score,
        percent,
        label: "Good",
        colorClass: "bg-[#a8cc3a]",
      };
    }

    return {
      score,
      percent,
      label: "Strong",
      colorClass: "bg-[#1D9E75]",
    };
  }, [isEditMode, passwordValue]);
    reset(nextValues);
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField label="Full name" error={errors.fullName?.message}>
        <Input
          autoComplete="off"
          error={errors.fullName}
          {...register("fullName", {
            required: "Full name is required.",
            validate: (v) =>
              v.trim().split(/\s+/).length >= 2 ||
              "Include first and last name.",
          })}
        />
      </FormField>

      <FormField label="Email address" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="off"
          error={errors.email}
          {...register("email", {
            required: "Email is required.",
            pattern: { value: /\S+@\S+\.\S+/, message: "Enter a valid email." },
          })}
        />
      </FormField>

      <FormField label="Phone number" error={errors.phoneNumber?.message}>
        <Input
          autoComplete="off"
          error={errors.phoneNumber}
          {...register("phoneNumber", {
            required: "Phone number is required.",
            pattern: {
              value: /^\+2519\d{8}$/,
            pattern: strictValidation
              ? {
                  value: /^[A-Z0-9._%+-]+@gmail\.com$/i,
                  message: "Email must be a @gmail.com address.",
                }
              : {
                  value: /\S+@\S+\.\S+/,
                  message: "Enter a valid email.",
                },
            },
          })}
        />
      </FormField>

      <FormField label="National ID" error={errors.nationalId?.message}>
        <Input
          autoComplete="off"
          error={errors.nationalId}
          {...register("nationalId", {
            required: "National ID is required.",
              value: strictValidation ? /^\+251\d{9}$/ : /^\+2519\d{8}$/,
              message: strictValidation
                ? "Phone number must start with +251 and be 13 characters."
                : "Must start with +2519 and be 13 digits.",
          })}
        />
      </FormField>

      {!defaultValues && (
        <FormField label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            error={errors.password}
            {...register("password", {
            pattern: strictValidation
              ? {
                  value: /^\d{12}$/,
                  message: "National ID must be exactly 12 digits.",
                }
              : {
                  value: /^.{12}$/,
                  message: "Must be exactly 12 characters.",
                },
              validate: {
                upper: (v) => /[A-Z]/.test(v) || "Must contain uppercase.",
                lower: (v) => /[a-z]/.test(v) || "Must contain lowercase.",
                number: (v) => /[0-9]/.test(v) || "Must contain a number.",
                special: (v) =>
                  /[!@#$%^&*]/.test(v) || "Must contain a special character.",
              },
            })}
          />
        </FormField>
      )}

      <FormField label="Officer type" error={errors.fieldOfficerType?.message}>
        <Select
          error={errors.fieldOfficerType}
          {...register("fieldOfficerType", {
            required: "Please select an officer type.",
          })}
        >
          <option value="">Select type</option>
          {typeOptions.map((typeOption) => (
            <option key={typeOption.value} value={typeOption.value}>
              {getOfficerTypeSelectLabel(typeOption.value)}
            </option>
          ))}
        </Select>
      </FormField>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#1D9E75] text-[#020f1a] font-syne font-bold py-3 rounded-xl hover:bg-[#5DCAA5] transition-all disabled:opacity-60 text-sm mt-2"
      >
        {loading
          ? "Saving..."
          : defaultValues
            ? "Update Officer"
            : "Create Officer"}
      </button>
    </form>
  );
}
