import { ConfigService } from '@nestjs/config';
import { ConfigType } from './config.types';

export class TypedConfigService extends ConfigService<ConfigType> {
  // This class extends the ConfigService to provide type-safe access to configuration
  // values defined in ConfigType. By using this TypedConfigService,
  // we can ensure that when we access configuration values, we get the correct types as defined in our configuration interfaces. This helps catch errors at compile time and provides better autocompletion and type checking when working with configuration values throughout the application.
}
