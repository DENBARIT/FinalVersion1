'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import FormField from '@/components/ui/FormField';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export default function OfficerForm({ onSubmit, defaultValues, loading }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    defaultValues ? reset({
      fullName: defaultValues.fullName,
      email: defaultValues.email,
      phoneNumber: defaultValues.phoneE164,
      nationalId: defaultValues.nationalId,
      fieldOfficerType: defaultValues.fieldOfficerType,
    }) : reset({});
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField label="Full name" error={errors.fullName?.message}>
        <Input
          placeholder="e.g. Dawit Bekele"
          error={errors.fullName}
          {...register('fullName', {
            required: 'Full name is required.',
            validate: (v) => v.trim().split(/\s+/).length >= 2 || 'Include first and last name.',
          })}
        />
      </FormField>

      <FormField label="Email address" error={errors.email?.message}>
        <Input
          type="email"
          placeholder="officer@aquaconnect.com"
          error={errors.email}
          {...register('email', {
            required: 'Email is required.',
            pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email.' },
          })}
        />
      </FormField>

      <FormField label="Phone number" error={errors.phoneNumber?.message}>
        <Input
          placeholder="+251912345678"
          error={errors.phoneNumber}
          {...register('phoneNumber', {
            required: 'Phone number is required.',
            pattern: { value: /^\+2519\d{8}$/, message: 'Must start with +2519 and be 13 digits.' },
          })}
        />
      </FormField>

      <FormField label="National ID" error={errors.nationalId?.message}>
        <Input
          placeholder="12 character ID"
          error={errors.nationalId}
          {...register('nationalId', {
            required: 'National ID is required.',
            validate: (v) => v.length === 12 || 'Must be exactly 12 characters.',
          })}
        />
      </FormField>

      {!defaultValues && (
        <FormField label="Password" error={errors.password?.message}>
          <Input
            type="password"
            placeholder="Min 8 chars, uppercase, number, special"
            error={errors.password}
            {...register('password', {
              required: 'Password is required.',
              minLength: { value: 8, message: 'At least 8 characters.' },
              validate: {
                upper: (v) => /[A-Z]/.test(v) || 'Must contain uppercase.',
                lower: (v) => /[a-z]/.test(v) || 'Must contain lowercase.',
                number: (v) => /[0-9]/.test(v) || 'Must contain a number.',
                special: (v) => /[!@#$%^&*]/.test(v) || 'Must contain a special character.',
              },
            })}
          />
        </FormField>
      )}

      <FormField label="Officer type" error={errors.fieldOfficerType?.message}>
        <Select
          error={errors.fieldOfficerType}
          {...register('fieldOfficerType', { required: 'Please select an officer type.' })}
        >
          <option value="">Select type</option>
          <option value="BILLING_OFFICER">Billing Officer</option>
          <option value="COMPLAINT_OFFICER">Complaint Officer</option>
        </Select>
      </FormField>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#1D9E75] text-[#020f1a] font-syne font-bold py-3 rounded-xl hover:bg-[#5DCAA5] transition-all disabled:opacity-60 text-sm mt-2"
      >
        {loading ? 'Saving...' : defaultValues ? 'Update Officer' : 'Create Officer'}
      </button>
    </form>
  );
}