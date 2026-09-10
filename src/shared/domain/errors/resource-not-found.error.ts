import { DomainError } from "./domain.error.js";

export class ResourceNotFoundError
  extends DomainError
{
  constructor(
    resource: string,
  ) {
    super(
      `${resource} not found`,
      'RESOURCE_NOT_FOUND',
    );
  }
}