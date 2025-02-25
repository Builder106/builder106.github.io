let currentSlide = 1;
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

function showSlide(index) {
   const slides = document.querySelectorAll('.carousel-item');
   const projectSections = document.querySelectorAll('.projects');
 
   if (index >= slides.length) {
     currentSlide = 0;
   } else if (index < 0) {
     currentSlide = slides.length - 1;
   } else {
     currentSlide = index;
   }
 
   slides.forEach((slide, i) => {
     slide.classList.toggle('active', i === currentSlide);
   });
 
   projectSections.forEach((section, i) => {
     section.style.display = i === currentSlide ? 'block' : 'none';
   });
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
  
  // Set up event listeners
  document.querySelector('.carousel-control.next').addEventListener('click', nextSlide);
  document.querySelector('.carousel-control.prev').addEventListener('click', prevSlide);
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
    document.body.classList.add('loaded');
  });
});

function copyToClipboard(text) {
   navigator.clipboard.writeText(text).then(function() {
     alert('Copied to clipboard');
   }, function(err) {
     console.error('Could not copy text: ', err);
   });
 }