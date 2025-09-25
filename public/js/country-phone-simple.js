// Optimized phone field implementation using REST Countries API only
async function fetchCountryData() {
  try {
    console.log('Fetching country data from REST Countries API...');
    const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,idd,flag');
    const countries = await response.json();
    
    // Process and filter countries
    const processedCountries = countries
      .filter(country => {
        // Exclude Israel (IL), include Palestine (PS)
        return country.cca2 !== 'IL' && country.idd && country.idd.root;
      })
      .map(country => {
        const dialCode = country.idd.root + (country.idd.suffixes ? country.idd.suffixes[0] || '' : '');
        return {
          name: country.name.common,
          iso: country.cca2,
          code: dialCode,
          flag: country.flag || `https://flagcdn.com/24x18/${country.cca2.toLowerCase()}.png`
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Loaded ${processedCountries.length} countries from API`);
    return processedCountries;
    
  } catch (error) {
    console.error('Failed to fetch country data from API:', error);
    throw new Error('Unable to load country data. Please check your internet connection and try again.');
  }
}

async function populateCountrySelect() {
  const countrySelect = document.getElementById('countrySelect');
  const phoneCodeSelect = document.getElementById('phoneCodeSelect');
  
  if (!countrySelect || !phoneCodeSelect) {
    console.error('Country or phone code select elements not found');
    return;
  }

  // Show loading state
  countrySelect.innerHTML = '<option value="">Loading countries...</option>';
  phoneCodeSelect.innerHTML = '<option value="">Loading codes...</option>';

  try {
    // Fetch country data from API
    const countryData = await fetchCountryData();
    
    // Clear loading options
    countrySelect.innerHTML = '<option value="">Select Country</option>';
    phoneCodeSelect.innerHTML = '<option value="">Phone Code</option>';

    // Populate country names
    countryData.forEach(country => {
      const option = document.createElement('option');
      option.value = country.iso;
      option.textContent = country.name;
      countrySelect.appendChild(option);
    });

    // Populate phone codes - use simple text format for reliability
    countryData.forEach(country => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = `${country.iso} ${country.code}`;
      phoneCodeSelect.appendChild(option);
    });

    console.log(`Successfully populated ${countryData.length} countries`);

    // Sync selections
    countrySelect.addEventListener('change', function() {
      const selectedCountry = countryData.find(c => c.iso === this.value);
      if (selectedCountry) {
        phoneCodeSelect.value = selectedCountry.code;
      } else {
        phoneCodeSelect.value = '';
      }
    });

    phoneCodeSelect.addEventListener('change', function() {
      const selectedCountry = countryData.find(c => c.code === this.value);
      if (selectedCountry) {
        countrySelect.value = selectedCountry.iso;
      } else {
        countrySelect.value = '';
      }
    });
    
  } catch (error) {
    console.error('Error populating country data:', error);
    countrySelect.innerHTML = '<option value="">Failed to load countries - Check connection</option>';
    phoneCodeSelect.innerHTML = '<option value="">Failed to load codes - Check connection</option>';
    
    // Show user-friendly error message
    alert('Unable to load country data. Please check your internet connection and refresh the page.');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', populateCountrySelect);
