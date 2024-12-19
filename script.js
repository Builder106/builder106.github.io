let currentSlide = 1;

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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.carousel-control.next').addEventListener('click', nextSlide);
  document.querySelector('.carousel-control.prev').addEventListener('click', prevSlide);
  showSlide(currentSlide);
});

function copyToClipboard(text) {
   navigator.clipboard.writeText(text).then(function() {
     alert('Copied to clipboard');
   }, function(err) {
     console.error('Could not copy text: ', err);
   });
 }

 document.getElementById('dark-mode-toggle').addEventListener('click', () => {
   const darkModeToggle = document.getElementById('dark-mode-toggle');
   const body = document.body;
   const button = document.querySelector('.button-light-mode');
 
   if (DarkReader.isEnabled()) {
     DarkReader.disable();
     darkModeToggle.src = 'img/light-mode.svg';
     body.classList.remove('dark-mode');
     button.classList.remove('dark-mode-button');
   } else {
     DarkReader.enable({
       brightness: 100,
       contrast: 90,
       sepia: 10
     });
     darkModeToggle.src = 'img/dark-mode.svg';
     body.classList.add('dark-mode');
     button.classList.add('dark-mode-button');
   }
 });