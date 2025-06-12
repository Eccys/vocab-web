import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import '../styles/Footer.css';
import '../styles/UrgentPopup.css';

const MySwal = withReactContent(Swal);

const Footer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/' || location.pathname === '';
  
  // Smooth scroll to section, handling cross-page navigation
  const scrollToSection = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    
    // If we're already on the homepage, just scroll to the section
    if (isHomePage) {
      scrollToElement(sectionId);
    } else {
      // Navigate to home page first, then scroll to section after navigation completes
      navigate('/', { state: { scrollTo: sectionId } });
    }
  };
  
  // Helper function to scroll to an element by ID
  const scrollToElement = (elementId: string) => {
    const section = document.getElementById(elementId);
    
    // Update URL hash without full page reload
    if (history.pushState) {
      history.pushState(null, '', `#${elementId}`);
    } else {
      window.location.hash = elementId;
    }
    
    if (section) {
      // Calculate accurate position
      const rect = section.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const offsetTop = rect.top + scrollTop;
      
      // Perform smooth scroll
      window.scrollTo({
        top: offsetTop - 80, // Account for header height
        behavior: 'smooth'
      });
      
      // Manually trigger a scroll event to update the header navigation
      window.dispatchEvent(new Event('scroll'));
      
      // Then again after scrolling completes to finalize
      setTimeout(() => {
        window.dispatchEvent(new Event('scroll'));
      }, 500);
    }
  };

  // Check if we have a section to scroll to from navigation state
  React.useEffect(() => {
    // This handles the case when we navigate from another page
    if (location.state && location.state.scrollTo) {
      const sectionId = location.state.scrollTo;
      
      // Need to wait for the page to fully render before scrolling
      setTimeout(() => {
        scrollToElement(sectionId);
        
        // Clear the navigation state to prevent scrolling on refresh
        navigate('/', { replace: true, state: {} });
      }, 100);
    }
  }, [location.state, navigate]);

  const handleDiscordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Ensure SweetAlert2 uses its own animation system properly
    MySwal.fire({
      title: '<span class="urgent-popup-title">Hold On!</span>',
      html: '<p class="urgent-popup-content">We don\'t have a discord! If you want to talk, or need a friend to listen to you, text us from <a href="https://ecys.xyz" target="_blank" rel="noopener noreferrer">https://ecys.xyz</a>.</p>',
      icon: 'warning',
      showClass: {
        popup: 'animate__animated animate__tada'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOut'
      },
      customClass: {
        popup: 'urgent-popup-container',
        title: 'urgent-popup-title',
        htmlContainer: 'urgent-popup-content',
        confirmButton: 'urgent-popup-confirm-button',
      },
      confirmButtonText: 'Got it!',
      backdrop: true,
      allowOutsideClick: false,
    });
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <img src="/images/v-bold.svg" alt="Vocab Logo" />
            <span>Vocab</span>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>App</h4>
              <a href="#features" className="footer-nav-link" onClick={(e) => scrollToSection(e, 'features')}>Features</a>
              <a href="#how-it-works" className="footer-nav-link" onClick={(e) => scrollToSection(e, 'how-it-works')}>How It Works</a>
              <a href="#download" className="footer-nav-link" onClick={(e) => scrollToSection(e, 'download')}>Download</a>
            </div>
            <div className="footer-column">
              <h4>Resources</h4>
              <a href="https://view.monday.com/8545115126-bda2f6d9a61e0f2787fcc41f19aac547?r=use1" target="_blank" className="footer-nav-link">Changelog</a>
              <a href="https://github.com/Eccys/vocab-boost/blob/stable/CONTRIBUTING.md" target="_blank" className="footer-nav-link">Contributing</a>
              <a href="https://github.com/Eccys/vocab-boost/releases" target="_blank" className="footer-nav-link">Releases</a>
            </div>
            <div className="footer-column">
              <h4>Connect</h4>
              <a href="https://github.com/eccys/vocab-boost" target="_blank" rel="noopener noreferrer" className="footer-nav-link">GitHub</a>
              <a href="#" onClick={handleDiscordClick} className="footer-nav-link">Discord</a>
              <a href="mailto:help.vocabboost@gmail.com" className="footer-nav-link">Email Us</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Vocab App. All rights reserved.</p>
          <p>Made with ❤️ by <a href="https://ecys.xyz" target="_blank" rel="noopener noreferrer">Ecys</a></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 