// @SerializeResource('project') — tells SerializeInterceptor which OWNER_ONLY_FIELDS map to apply.
import { SetMetadata } from '@nestjs/common';

export const SERIALIZE_RESOURCE_KEY = 'serializeResource';

export const SerializeResource = (resource: string): MethodDecorator & ClassDecorator =>
  SetMetadata(SERIALIZE_RESOURCE_KEY, resource);

/** Marker decorator for handlers/classes whose entire response is owner-only. */
export const OWNER_ONLY_KEY = 'ownerOnly';
export const OwnerOnly = (): MethodDecorator & ClassDecorator => SetMetadata(OWNER_ONLY_KEY, true);
