let currentSlide = 0;
let darkModeState = localStorage.getItem('darkMode') === 'enabled';

// Initialize animations on scroll
function initAnimations() {
  const animatedElements = document.querySelectorAll('.hero, .about, .div-4, .experience, .work, .contact');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  animatedElements.forEach(element => {
    observer.observe(element);
  });
}

// Handle image loading and fallbacks
function initImageHandling() {
  const projectImages = document.querySelectorAll('.projects .picture-wrapper img');
  
  projectImages.forEach(img => {
    // Add loading state
    img.style.opacity = '0';
    
    // Handle successful load
    img.onload = function() {
      this.style.opacity = '1';
    };
    
    // Handle load error
    img.onerror = function() {
      console.warn('Failed to load image:', this.src);
      this.style.opacity = '0.5';
      this.style.filter = 'grayscale(100%)';
    };
    
    // Force reload if image is already loaded
    if (img.complete) {
      img.style.opacity = '1';
    }
  });
}

function showSlide(newIndexCandidate) {
  const slides = document.querySelectorAll('.carousel-item'); // These are the filter buttons
  const projectSections = document.querySelectorAll('.projects'); // These are the content sections

  if (slides.length === 0) {
    return; // No slides to operate on
  }

  // Calculate the actual new currentSlide index, handling wrap-around
  if (newIndexCandidate >= slides.length) {
    currentSlide = 0;
  } else if (newIndexCandidate < 0) {
    currentSlide = slides.length - 1;
  } else {
    currentSlide = newIndexCandidate;
  }

  // Get the target carousel item element
  const targetSlideElement = slides[currentSlide];

  if (targetSlideElement) {
    // Extract projectId from the target slide element's onclick attribute
    // It looks like: setActiveSlide(this, 'projects-X')
    const onclickAttr = targetSlideElement.getAttribute('onclick');
    if (onclickAttr) {
      const match = onclickAttr.match(/setActiveSlide\s*\(\s*this\s*,\s*'([^']+)'\s*\)/);
      if (match && match[1]) {
        const targetProjectId = match[1];
        
        // Remove 'active' from all carousel items
        slides.forEach(item => {
          item.classList.remove('active');
        });
        
        // Hide all project sections
        projectSections.forEach(section => {
          section.style.display = 'none';
        });
        
        // Activate the target slide and show its project section
        targetSlideElement.classList.add('active');
        const projectToShow = document.getElementById(targetProjectId);
        if (projectToShow) {
          projectToShow.style.display = 'block';
        }
      }
    }
  }
}

function setActiveSlide(element, projectId) {
   const activeClass = 'active';
   const carouselItems = document.querySelectorAll('.carousel-item');
   const projectSections = document.querySelectorAll('.projects');
 
   carouselItems.forEach(item => {
     item.classList.remove(activeClass);
   });
 
   projectSections.forEach(section => {
     section.style.display = 'none';
   });
 
   element.classList.add(activeClass);
   document.getElementById(projectId).style.display = 'block';
 }

function nextSlide() {
  showSlide(currentSlide - 1);
}

function prevSlide() {
  showSlide(currentSlide + 1);
}

function toggleDarkMode() {
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const body = document.body;

  if (darkModeState) {
    DarkReader.disable();
    darkModeToggle.src = 'img/light-mode.svg';
    body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'disabled');
    darkModeState = false;
  } else {
    DarkReader.enable({
      brightness: 100,
      contrast: 90,
      sepia: 10
    });
    darkModeToggle.src = 'img/dark-mode.svg';
    body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'enabled');
    darkModeState = true;
  }
}

// Handle contact form submission
function handleContactFormSubmit(event) {
  event.preventDefault();
  
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const messageInput = document.getElementById('message');
  
  // Simple validation
  if (!nameInput.value || !emailInput.value || !messageInput.value) {
    alert('Please fill in all fields');
    return;
  }
  
  // In a real application, you would send this data to a server
  // For now, we'll just show a success message
  const formData = {
    name: nameInput.value,
    email: emailInput.value,
    message: messageInput.value
  };
  
  console.log('Form data:', formData);
  
  // Show success message
  alert('Thank you for your message! I will get back to you soon.');
  
  // Reset form
  document.getElementById('contact-form').reset();
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize dark mode based on saved preference
  if (darkModeState) {
    DarkReader.enable({
      brightness: 100,
      contrast: 90,
      sepia: 10
    });
    document.getElementById('dark-mode-toggle').src = 'img/dark-mode.svg';
    document.body.classList.add('dark-mode');
  }

  // Initialize animations
  initAnimations();
  
  // Initialize image handling
  initImageHandling();
  
  // Set up event listeners
  const nextButton = document.querySelector('.carousel-control.next');
  if (nextButton) {
    nextButton.addEventListener('click', nextSlide);
  }
  
  const prevButton = document.querySelector('.carousel-control.prev');
  if (prevButton) {
    prevButton.addEventListener('click', prevSlide);
  }
  document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
  
  // Add contact form submission handler
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactFormSubmit);
  }
  
  // Initialize carousel
  showSlide(currentSlide);
  
  // Add scroll to top button functionality
  const scrollTopBtn = document.getElementById('scroll-top-btn');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      if (document.body.scrollTop > 500 || document.documentElement.scrollTop > 500) {
        scrollTopBtn.style.display = 'block';
      } else {
        scrollTopBtn.style.display = 'none';
      }
    });
    
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
  
  // Hide loader after page is fully loaded
  window.addEventListener('load', () => {
    const loaderWrapper = document.getElementById('loader-wrapper');
    if (loaderWrapper) {
      // Start the transition with !important
      loaderWrapper.style.setProperty('opacity', '0', 'important');
      loaderWrapper.style.setProperty('visibility', 'hidden', 'important');
      
      // After the transition (0.5s = 500ms), set display to none with !important
      setTimeout(() => {
        loaderWrapper.style.setProperty('display', 'none', 'important');
      }, 500); // Duration matches your CSS transition
    } else {
      // If you ever see this, it means the loader wrapper was not found in the DOM.
      // Ensure your HTML has <div id="loader-wrapper">...</div>
      console.error('Loader wrapper element (#loader-wrapper) not found!'); 
    }
  });
});

function copyToClipboard(text) {
   navigator.clipboard.writeText(text).then(function() {
     alert('Copied to clipboard');
   }, function(err) {
     console.error('Could not copy text: ', err);
   });
 }