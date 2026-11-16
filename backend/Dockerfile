FROM php:8.2-apache

# PHP extensions: pdo_mysql (database), zip (reading .docx resumes), opcache (compiled PHP
# kept in memory, so a request does not recompile the framework every time)
RUN apt-get update && apt-get install -y --no-install-recommends \
    unzip \
    libzip-dev \
    && docker-php-ext-install pdo pdo_mysql zip opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Production PHP settings: no error display, no version banner, upload limits, OPcache.
# validate_timestamps=0 is safe because the code never changes inside a running container.
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && { echo "expose_php=Off"; echo "display_errors=Off"; echo "upload_max_filesize=10M"; echo "post_max_size=12M"; echo "memory_limit=256M"; } > "$PHP_INI_DIR/conf.d/zz-hanapbuhay.ini" \
    && { echo "opcache.enable=1"; echo "opcache.memory_consumption=96"; echo "opcache.max_accelerated_files=10000"; echo "opcache.validate_timestamps=0"; echo "realpath_cache_ttl=600"; } > "$PHP_INI_DIR/conf.d/zz-opcache.ini" \
    && sed -i 's/^ServerTokens .*/ServerTokens Prod/; s/^ServerSignature .*/ServerSignature Off/' /etc/apache2/conf-available/security.conf

# Composer (autoloads app/libraries, see composer.json)
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Apache: mod_rewrite for the routes, gzip for JSON answers, .htaccess allowed
RUN a2enmod rewrite deflate \
    && echo 'AddOutputFilterByType DEFLATE application/json text/plain text/html' > /etc/apache2/conf-enabled/zz-json-gzip.conf \
    && sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

WORKDIR /var/www/html
COPY . /var/www/html/
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Only public/ is served; app/, scheme/, runtime/ and .env stay out of reach of the web
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot ${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf \
    && sed -i 's|<Directory /var/www/html>|<Directory ${APACHE_DOCUMENT_ROOT}>|g' /etc/apache2/apache2.conf

# runtime/ (cache, logs) is the only place the app writes
RUN mkdir -p /var/www/html/runtime/logs /var/www/html/runtime/cache \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/runtime

# Start: Apache on Render's PORT (default 10000), pending migrations checked alongside.
# (CRs stripped in case the script was checked out on Windows)
RUN sed -i 's/\r$//' /var/www/html/docker-start.sh && chmod +x /var/www/html/docker-start.sh
CMD ["sh", "/var/www/html/docker-start.sh"]
