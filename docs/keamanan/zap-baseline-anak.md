# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 1 |
| Low | 3 |
| Informational | 5 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 6    |
| Info | Informational | http://10.77.0.1:3136 | Percentage of responses with status code 2xx | 92 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of responses with status code 3xx | 5 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of responses with status code 4xx | 2 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type application/javascript | 24 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type application/manifest+json | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type image/png | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type image/svg+xml | 2 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type image/x-icon | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type text/css | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type text/html | 63 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with method GET | 100 % |
| Info | Informational | http://10.77.0.1:3136 | Count of total endpoints | 86    |
| Info | Informational | http://10.77.0.1:3136 | Percentage of slow responses | 79 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| CSP: style-src unsafe-inline | Medium | Systemic |
| Big Redirect Detected (Potential Sensitive Information Leak) | Low | 1 |
| Cross-Origin-Embedder-Policy Header Missing or Invalid | Low | 2 |
| Cross-Origin-Resource-Policy Header Missing or Invalid | Low | Systemic |
| Modern Web Application | Informational | Systemic |
| Non-Storable Content | Informational | Systemic |
| Storable and Cacheable Content | Informational | 4 |
| Storable but Non-Cacheable Content | Informational | 2 |
| User Controllable HTML Element Attribute (Potential XSS) | Informational | 3 |




## Alert Detail



### [ CSP: style-src unsafe-inline ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-NDhjNmVkY2UtODI1Ni00ZGRiLWJhMDktYmIxNzYxNzA3Mjkw' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-YzlhNTgyNzEtOGM3My00OTM3LThlYTQtZTFmODEyZDdhYWEx' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://10.77.0.1:3136/robots.txt
  * Node Name: `http://10.77.0.1:3136/robots.txt`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-NjU0NGY1MTUtYmY4YS00NzFmLWFjOGItZWMwNTBhMWVkYWU0' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://10.77.0.1:3136/sitemap.xml
  * Node Name: `http://10.77.0.1:3136/sitemap.xml`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-YmI0NWNiOWQtODg2My00ZGFlLTgwNzMtMmFiYjljMzkwZGM1' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://10.77.0.1:3136/today
  * Node Name: `http://10.77.0.1:3136/today`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-NzM3Nzc5MjItZWFhMy00ZmJlLWIzMzQtZmM1ODliZDg4M2Q1' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`

Instances: Systemic


### Solution

Ensure that your web server, application server, load balancer, etc. is properly configured to set the Content-Security-Policy header.

### Reference


* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://caniuse.com/#search=content+security+policy ](https://caniuse.com/#search=content+security+policy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)
* [ https://github.com/HtmlUnit/htmlunit-csp ](https://github.com/HtmlUnit/htmlunit-csp)
* [ https://web.dev/articles/csp#resource-options ](https://web.dev/articles/csp#resource-options)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ Big Redirect Detected (Potential Sensitive Information Leak) ](https://www.zaproxy.org/docs/alerts/10044/)



##### Low (Medium)

### Description

The server has responded with a redirect that seems to provide a large response. This may indicate that although the server sent a redirect it also responded with body content (which may include sensitive details, PII, etc.).

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 6 [/today].
Predicted response size: 306.
Response Body Length: 8,444.`


Instances: 1

### Solution

Ensure that no sensitive information is leaked via redirect responses. Redirect responses should have almost no content.

### Reference



#### CWE Id: [ 201 ](https://cwe.mitre.org/data/definitions/201.html)


#### WASC Id: 13

#### Source ID: 3

### [ Cross-Origin-Embedder-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Embedder-Policy header is a response header that prevents a document from loading any cross-origin resources that don't explicitly grant the document permission (using CORP or CORS).

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/today
  * Node Name: `http://10.77.0.1:3136/today`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 2

### Solution

Ensure that the application/web server sets the Cross-Origin-Embedder-Policy header appropriately, and that it sets the Cross-Origin-Embedder-Policy header to 'require-corp' for documents.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Embedder-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-embedder-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Cross-Origin-Resource-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Resource-Policy header is an opt-in header designed to counter side-channels attacks like Spectre. Resource should be specifically set as shareable amongst different origins.

* URL: http://10.77.0.1:3136/_next/static/chunks/176na8y6-lw9-.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/176na8y6-lw9-.js`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/1_g66hkhn9a15.css
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/1_g66hkhn9a15.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/3wrrzfq13dxk_.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/3wrrzfq13dxk_.js`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/icons/icon.svg
  * Node Name: `http://10.77.0.1:3136/icons/icon.svg`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/today
  * Node Name: `http://10.77.0.1:3136/today`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that the application/web server sets the Cross-Origin-Resource-Policy header appropriately, and that it sets the Cross-Origin-Resource-Policy header to 'same-origin' for all web pages.
'same-site' is considered as less secured and should be avoided.
If resources must be shared, set the header to 'cross-origin'.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Resource-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-resource-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="NDhjNmVkY2UtODI1Ni00ZGRiLWJhMDktYmIxNzYxNzA3Mjkw"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://10.77.0.1:3136/run/04b476f2-f066-44ce-a316-8607f77285e0
  * Node Name: `http://10.77.0.1:3136/run/04b476f2-f066-44ce-a316-8607f77285e0`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="M2IzNjJlYjYtMjNmMi00YWRlLWIwYTctNzE0MWU2NmM2NDEz"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://10.77.0.1:3136/run/8712f576-3466-483e-a25f-272f17cf91e2
  * Node Name: `http://10.77.0.1:3136/run/8712f576-3466-483e-a25f-272f17cf91e2`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="NmM4OGU3M2QtOTE4OS00MGU5LWFiZmMtNmUyMGE5OTE1ZWIx"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://10.77.0.1:3136/run/b432d23a-19ab-45a7-89f2-af8e1c747135
  * Node Name: `http://10.77.0.1:3136/run/b432d23a-19ab-45a7-89f2-af8e1c747135`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="ZGFiMDBhMjEtNGJlNS00MDVkLWFlNWQtZGMzZjAwMjc4OGMw"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://10.77.0.1:3136/run/ba8fc723-5f67-4c40-a324-89f84827bd8f
  * Node Name: `http://10.77.0.1:3136/run/ba8fc723-5f67-4c40-a324-89f84827bd8f`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="NjFlMDdhZDEtYWM4Ni00YTNjLWE3NDMtMzlmMTFhNjI0YzEz"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`

Instances: Systemic


### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://10.77.0.1:3136/favicon.ico
  * Node Name: `http://10.77.0.1:3136/favicon.ico`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://10.77.0.1:3136/robots.txt
  * Node Name: `http://10.77.0.1:3136/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://10.77.0.1:3136/sitemap.xml
  * Node Name: `http://10.77.0.1:3136/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://10.77.0.1:3136/today
  * Node Name: `http://10.77.0.1:3136/today`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``

Instances: Systemic


### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: http://10.77.0.1:3136/_next/static/chunks/0t0n8l7xmk0-p.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/0t0n8l7xmk0-p.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/176na8y6-lw9-.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/176na8y6-lw9-.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/1_g66hkhn9a15.css
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/1_g66hkhn9a15.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/3wrrzfq13dxk_.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/3wrrzfq13dxk_.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``


Instances: 4

### Solution

Validate that the response does not contain sensitive, personal or user-specific information. If it does, consider the use of the following HTTP response headers, to limit, or prevent the content being stored and retrieved from the cache by another user:
Cache-Control: no-cache, no-store, must-revalidate, private
Pragma: no-cache
Expires: 0
This configuration directs both HTTP 1.0 and HTTP 1.1 compliant caching servers to not store the response, and to not retrieve the response (without validation) from the cache, in response to a similar request.

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable but Non-Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, but will not be retrieved directly from the cache, without validating the request upstream, in response to similar requests from other users.

* URL: http://10.77.0.1:3136/icons/apple-touch-icon.png
  * Node Name: `http://10.77.0.1:3136/icons/apple-touch-icon.png`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``
* URL: http://10.77.0.1:3136/icons/icon.svg
  * Node Name: `http://10.77.0.1:3136/icons/icon.svg`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``


Instances: 2

### Solution



### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ User Controllable HTML Element Attribute (Potential XSS) ](https://www.zaproxy.org/docs/alerts/10031/)



##### Informational (Low)

### Description

This check looks at user-supplied input in query string parameters and POST data to identify where certain HTML attribute values might be controlled. This provides hot-spot detection for XSS (cross-site scripting) that will require further review by a security analyst to determine exploitability.

* URL: http://10.77.0.1:3136/lesson/e2.vowel-spellings%3Fthen=%252Frun%252F04b476f2-f066-44ce-a316-8607f77285e0
  * Node Name: `http://10.77.0.1:3136/lesson/e2.vowel-spellings (then)`
  * Method: `GET`
  * Parameter: `then`
  * Attack: ``
  * Evidence: ``
  * Other Info: `User-controlled HTML attribute values were found. Try injecting special characters to see if XSS might be possible. The page at the following URL:

http://10.77.0.1:3136/lesson/e2.vowel-spellings?then=%2Frun%2F04b476f2-f066-44ce-a316-8607f77285e0

appears to include user input in:
a(n) [a] tag [href] attribute

The user input found was:
then=/run/04b476f2-f066-44ce-a316-8607f77285e0

The user-controlled value was:
/run/04b476f2-f066-44ce-a316-8607f77285e0`
* URL: http://10.77.0.1:3136/lesson/m2.numbers-to-100%3Fthen=%252Frun%252Fba8fc723-5f67-4c40-a324-89f84827bd8f
  * Node Name: `http://10.77.0.1:3136/lesson/m2.numbers-to-100 (then)`
  * Method: `GET`
  * Parameter: `then`
  * Attack: ``
  * Evidence: ``
  * Other Info: `User-controlled HTML attribute values were found. Try injecting special characters to see if XSS might be possible. The page at the following URL:

http://10.77.0.1:3136/lesson/m2.numbers-to-100?then=%2Frun%2Fba8fc723-5f67-4c40-a324-89f84827bd8f

appears to include user input in:
a(n) [a] tag [href] attribute

The user input found was:
then=/run/ba8fc723-5f67-4c40-a324-89f84827bd8f

The user-controlled value was:
/run/ba8fc723-5f67-4c40-a324-89f84827bd8f`
* URL: http://10.77.0.1:3136/lesson/s2.living-things%3Fthen=%252Frun%252F069e9ce3-4db6-48d4-aa89-81e539ee3cdd
  * Node Name: `http://10.77.0.1:3136/lesson/s2.living-things (then)`
  * Method: `GET`
  * Parameter: `then`
  * Attack: ``
  * Evidence: ``
  * Other Info: `User-controlled HTML attribute values were found. Try injecting special characters to see if XSS might be possible. The page at the following URL:

http://10.77.0.1:3136/lesson/s2.living-things?then=%2Frun%2F069e9ce3-4db6-48d4-aa89-81e539ee3cdd

appears to include user input in:
a(n) [a] tag [href] attribute

The user input found was:
then=/run/069e9ce3-4db6-48d4-aa89-81e539ee3cdd

The user-controlled value was:
/run/069e9ce3-4db6-48d4-aa89-81e539ee3cdd`


Instances: 3

### Solution

Validate all input and sanitize output it before writing to any HTML attributes.

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html ](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)


#### CWE Id: [ 20 ](https://cwe.mitre.org/data/definitions/20.html)


#### WASC Id: 20

#### Source ID: 3


