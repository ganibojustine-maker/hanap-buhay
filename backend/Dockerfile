FROM php:8.2-apache

# Install system dependencies & PHP extensions
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    libcurl4-openssl-dev \
    && docker-php-ext-install pdo pdo_mysql zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Production PHP settings (no error display, no version banner, sane upload limits)
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && { echo "expose_php=Off"; echo "display_errors=Off"; echo "upload_max_filesize=10M"; echo "post_max_size=12M"; echo "memory_limit=256M"; } > "$PHP_INI_DIR/conf.d/zz-hanapbuhay.ini" \
    && sed -i 's/^ServerTokens .*/ServerTokens Prod/; s/^ServerSignature .*/ServerSignature Off/' /etc/apache2/conf-available/security.conf

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Enable Apache mod_rewrite & allow .htaccess
RUN a2enmod rewrite \
    && sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . /var/www/html/

# Install PHP dependencies via Composer
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Point Apache document root to public/
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot ${APACHE_DOCUMENT_ROOT}|g' /etc/apache2/sites-available/000-default.conf \
    && sed -i 's|<Directory /var/www/html>|<Directory ${APACHE_DOCUMENT_ROOT}>|g' /etc/apache2/apache2.conf

# Ensure runtime cache & logs directories exist with write permissions
RUN mkdir -p /var/www/html/runtime/logs /var/www/html/runtime/cache \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 777 /var/www/html/runtime

# Start: apply pending database migrations, then bind Apache to Render's PORT (default 10000).
# (CRs stripped in case the script was checked out on Windows)
RUN sed -i 's/\r$//' /var/www/html/docker-start.sh && chmod +x /var/www/html/docker-start.sh
CMD ["sh", "/var/www/html/docker-start.sh"]
